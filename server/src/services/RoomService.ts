// ============================================================
//  server/src/services/RoomService.ts
//
//  Central in-memory room registry + optional MongoDB persistence.
//
//  RAM is always the source of truth for live state.
//  MongoDB is written on:
//    - createRoom
//    - playback changes (debounced 1.5s)
//    - deleteRoom
//
//  On server startup, loadRoomsFromDb() rehydrates RAM.
// ============================================================

import mongoose from "mongoose";
import { Room } from "../models/Room";
import { Participant } from "../models/Participant";
import { PlayState, Role } from "../types";
import { generateRoomId } from "../utils/roomId";
import { env } from "../config/env";
import { RoomModel } from "../models/RoomModel";

interface SocketMapping {
    userId: string;
    roomId: string;
}

export class RoomService {
    private rooms: Map<string, Room> = new Map();
    private socketToUser: Map<string, SocketMapping> = new Map();

    // Pending debounced DB write per room.
    private dbWriteTimers: Map<string, NodeJS.Timeout> = new Map();

    // ---------- DB helpers ----------
    private isDbEnabled(): boolean {
        return (
            !!env.MONGODB_URI &&
            mongoose.connection.readyState === 1
        );
    }

    private scheduleDbWrite(roomId: string): void {
        if (!this.isDbEnabled()) return;

        const existing = this.dbWriteTimers.get(roomId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.dbWriteTimers.delete(roomId);
            void this.flushRoomToDb(roomId);
        }, 1500);

        this.dbWriteTimers.set(roomId, timer);
    }

    private async flushRoomToDb(roomId: string): Promise<void> {
        if (!this.isDbEnabled()) return;
        const room = this.rooms.get(roomId);
        if (!room) return;

        try {
            await RoomModel.updateOne(
                { roomId },
                {
                    hostId: room.hostId,
                    videoId: room.videoId,
                    currentTime: room.currentTime,
                    playState: room.playState,
                    updatedAt: new Date(),
                }
            );
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[db] flush failed for room ${roomId}:`, err);
        }
    }

    // ---------- Room lifecycle ----------
    createRoom(hostId: string): Room {
        let roomId = generateRoomId();
        let attempts = 0;
        while (this.rooms.has(roomId) && attempts < 20) {
            roomId = generateRoomId();
            attempts++;
        }

        const room = new Room(roomId, hostId);
        this.rooms.set(roomId, room);

        // Persist to MongoDB (non-blocking).
        if (this.isDbEnabled()) {
            RoomModel.create({
                roomId,
                hostId,
                videoId: null,
                currentTime: 0,
                playState: "paused",
            }).catch((err) =>
                // eslint-disable-next-line no-console
                console.error("[db] createRoom failed:", err)
            );
        }

        return room;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    hasRoom(roomId: string): boolean {
        return this.rooms.has(roomId);
    }

    deleteRoom(roomId: string): void {
        this.rooms.delete(roomId);

        // Cancel any pending write.
        const timer = this.dbWriteTimers.get(roomId);
        if (timer) {
            clearTimeout(timer);
            this.dbWriteTimers.delete(roomId);
        }

        // Remove from MongoDB.
        if (this.isDbEnabled()) {
            RoomModel.deleteOne({ roomId }).catch((err) =>
                // eslint-disable-next-line no-console
                console.error("[db] deleteRoom failed:", err)
            );
        }
    }

    // ---------- Startup hydration ----------
    /**
     * Load all persisted rooms from MongoDB into RAM.
     * Called once during server startup.
     */
    async loadRoomsFromDb(): Promise<number> {
        if (!this.isDbEnabled()) return 0;

        try {
            const docs = await RoomModel.find({}).lean();
            let loaded = 0;

            for (const d of docs) {
                if (this.rooms.has(d.roomId)) continue; // RAM already has it

                const room = new Room(d.roomId, d.hostId);
                room.videoId = d.videoId ?? null;
                room.currentTime = d.currentTime ?? 0;
                room.playState = (d.playState as PlayState) ?? "paused";
                this.rooms.set(d.roomId, room);
                loaded++;
            }

            // eslint-disable-next-line no-console
            console.log(`[db] hydrated ${loaded} room(s) from MongoDB`);
            return loaded;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[db] loadRoomsFromDb failed:", err);
            return 0;
        }
    }

    // ---------- Participants ----------
    addParticipant(roomId: string, participant: Participant): void {
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.addParticipant(participant);
        this.socketToUser.set(participant.socketId, {
            userId: participant.userId,
            roomId,
        });
    }

    removeParticipant(roomId: string, userId: string): Participant | undefined {
        const room = this.rooms.get(roomId);
        if (!room) return undefined;
        const removed = room.removeParticipant(userId);
        if (removed) {
            this.socketToUser.delete(removed.socketId);
        }
        return removed;
    }

    removeParticipantBySocket(
        socketId: string
    ): { participant: Participant; room: Room } | null {
        const info = this.socketToUser.get(socketId);
        if (!info) return null;

        const room = this.rooms.get(info.roomId);
        this.socketToUser.delete(socketId);
        if (!room) return null;

        const participant = room.getParticipant(info.userId);
        if (!participant) return null;

        room.removeParticipant(info.userId);

        if (participant.userId === room.hostId) {
            this.promoteNextHost(room);
        }

        if (room.isEmpty()) {
            this.deleteRoom(room.roomId);
        }

        return { participant, room };
    }

    private promoteNextHost(room: Room): void {
        const remaining = room.getParticipants();
        if (remaining.length === 0) return;

        const next =
            remaining.find((p) => p.role === "moderator") ?? remaining[0];

        next.role = "host";
        room.hostId = next.userId;

        // Persist the host change (debounced).
        this.scheduleDbWrite(room.roomId);
    }

    // ---------- Roles ----------
    assignRole(roomId: string, userId: string, role: Role): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        return room.assignRole(userId, role);
    }

    transferHost(roomId: string, newHostUserId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        const ok = room.transferHost(newHostUserId);
        if (ok) this.scheduleDbWrite(roomId);
        return ok;
    }

    // ---------- Playback ----------
    updatePlayback(
        roomId: string,
        state: {
            videoId?: string | null;
            currentTime?: number;
            playState?: PlayState;
        }
    ): void {
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.updatePlayback(state);

        // Persist playback state (debounced 1.5s).
        this.scheduleDbWrite(roomId);
    }

    // ---------- Lookups ----------
    getParticipants(roomId: string): Participant[] {
        const room = this.rooms.get(roomId);
        return room ? room.getParticipants() : [];
    }

    getRoomBySocket(socketId: string): Room | undefined {
        const info = this.socketToUser.get(socketId);
        if (!info) return undefined;
        return this.rooms.get(info.roomId);
    }

    getParticipantBySocket(socketId: string): Participant | undefined {
        const info = this.socketToUser.get(socketId);
        if (!info) return undefined;
        const room = this.rooms.get(info.roomId);
        if (!room) return undefined;
        return room.getParticipant(info.userId);
    }

    getRoomIdBySocket(socketId: string): string | undefined {
        return this.socketToUser.get(socketId)?.roomId;
    }
}

export const roomService = new RoomService();