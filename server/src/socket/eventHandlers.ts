// ============================================================
//  server/src/socket/eventHandlers.ts
//
//  Wires Socket.IO events to business logic:
//    socket.on(event)
//       ↓
//    resolve participant + room
//       ↓
//    check permission (backend-enforced RBAC)
//       ↓
//    update room state via RoomService
//       ↓
//    broadcast new state to the room
//
//  Never trust the client. Every privileged event is validated
//  here regardless of what the UI chooses to show.
//
//  This file also declares the strongly-typed Socket.IO event
//  maps (ClientToServerEvents / ServerToClientEvents) so that
//  server.ts and socketHandler.ts can create a fully typed
//  Server instance.
// ============================================================

import { Server, Socket } from "socket.io";
import { Room } from "../models/Room";
import { Participant } from "../models/Participant";
import { roomService } from "../services/RoomService";
import { permissionService } from "../services/PermissionService";
import { extractYouTubeVideoId } from "../utils/youtube";
import {
    AssignRolePayload,
    ChangeVideoPayload,
    ChatMessage,
    ErrorPayload,
    JoinRoomPayload,
    LeaveRoomPayload,
    PausePayload,
    PlayPayload,
    PublicParticipant,
    ReactionBroadcast,
    ReactionEmoji,
    ReactionPayload,
    RemoveParticipantPayload,
    Role,
    RoomState,
    SeekPayload,
    SendMessagePayload,
    SocketData,
    TransferHostPayload,
} from "../types";

// ============================================================
//  Socket.IO event type maps
// ============================================================

// ---------- Client → Server ----------
export interface ClientToServerEvents {
    join_room: (payload: JoinRoomPayload) => void;
    leave_room: (payload: LeaveRoomPayload) => void;
    play: (payload: PlayPayload) => void;
    pause: (payload: PausePayload) => void;
    seek: (payload: SeekPayload) => void;
    change_video: (payload: ChangeVideoPayload) => void;
    assign_role: (payload: AssignRolePayload) => void;
    remove_participant: (payload: RemoveParticipantPayload) => void;
    transfer_host: (payload: TransferHostPayload) => void;
    send_message: (payload: SendMessagePayload) => void;
    reaction: (payload: ReactionPayload) => void;
}

// ---------- Server → Client ----------
export interface ServerToClientEvents {
    sync_state: (state: RoomState) => void;
    user_joined: (payload: {
        userId: string;
        username: string;
        role: Role;
        hostId: string;
        participants: PublicParticipant[];
    }) => void;
    user_left: (payload: {
        userId: string;
        username: string;
        participants: PublicParticipant[];
        hostId: string;
    }) => void;
    role_assigned: (payload: {
        userId: string;
        username: string;
        role: Role;
        hostId: string;
        participants: PublicParticipant[];
    }) => void;
    participant_removed: (payload: {
        userId: string;
        username: string;
        participants: PublicParticipant[];
        hostId: string;
    }) => void;
    host_transferred: (payload: {
        previousHostId: string;
        newHostId: string;
        hostId: string;
        participants: PublicParticipant[];
    }) => void;
    new_message: (payload: ChatMessage) => void;
    new_reaction: (payload: ReactionBroadcast) => void;
    error: (payload: ErrorPayload) => void;
}

// ---------- Inter-server (unused for MVP but required by socket.io) ----------
export interface InterServerEvents {}

// ---------- Typed aliases ----------
export type TypedServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

export type TypedSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

// ============================================================
//  Constants
// ============================================================
const MAX_USERNAME_LENGTH = 30;
const MAX_CHAT_MESSAGE_LENGTH = 500;
const ALLOWED_REACTIONS: ReactionEmoji[] = ["👍", "❤️", "😂", "🔥", "👏"];

// ============================================================
//  Helpers
// ============================================================
function data(socket: TypedSocket): SocketData {
    return socket.data;
}

function emitError(
    socket: TypedSocket,
    code: string,
    message: string,
    event?: string
): void {
    const payload: ErrorPayload = { code, message };
    if (event) payload.event = event;
    socket.emit("error", payload);
}

function buildState(room: Room): RoomState {
    return room.toState();
}

function broadcastSyncState(io: TypedServer, room: Room): void {
    io.to(room.roomId).emit("sync_state", buildState(room));
}

function isValidUsername(raw: unknown): raw is string {
    if (typeof raw !== "string") return false;
    const t = raw.trim();
    return t.length >= 1 && t.length <= MAX_USERNAME_LENGTH;
}

function makeId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Resolves the participant + room for the current socket.
 * Emits an error and returns null if either is missing.
 */
function requireParticipant(
    socket: TypedSocket,
    eventName: string
): { participant: Participant; room: Room } | null {
    const participant = roomService.getParticipantBySocket(socket.id);
    if (!participant) {
        emitError(socket, "USER_NOT_FOUND", "You are not in a room.", eventName);
        return null;
    }
    const room = roomService.getRoomBySocket(socket.id);
    if (!room) {
        emitError(socket, "ROOM_NOT_FOUND", "Room no longer exists.", eventName);
        return null;
    }
    return { participant, room };
}

// ============================================================
//  Main entry — registers all handlers for one socket
// ============================================================
export function registerEventHandlers(
    io: TypedServer,
    socket: TypedSocket
): void {
    // =========================================================
    // join_room
    // =========================================================
    socket.on("join_room", (payload: JoinRoomPayload) => {
        const { roomId, username } = payload ?? ({} as JoinRoomPayload);

        if (!roomId || typeof roomId !== "string") {
            return emitError(socket, "ROOM_NOT_FOUND", "Room ID is required.", "join_room");
        }
        if (!isValidUsername(username)) {
            return emitError(
                socket,
                "INVALID_USERNAME",
                `Username must be 1–${MAX_USERNAME_LENGTH} characters.`,
                "join_room"
            );
        }

        const room = roomService.getRoom(roomId);
        if (!room) {
            return emitError(socket, "ROOM_NOT_FOUND", "Room not found.", "join_room");
        }

        const userId = data(socket).userId;

        // If socket is already in a different room, leave it first.
        const previousRoomId = data(socket).roomId;
        if (previousRoomId && previousRoomId !== roomId) {
            leaveCurrentRoom(io, socket);
        }

        // Remove any stale participant entries for this socket or userId.
        const existingBySocket = room.getParticipantBySocket(socket.id);
        if (existingBySocket) {
            room.removeParticipant(existingBySocket.userId);
        }
        const existingByUser = room.getParticipant(userId);
        if (existingByUser) {
            room.removeParticipant(userId);
        }

        const role: Role = userId === room.hostId ? "host" : "participant";
        const participant = new Participant(
            userId,
            username.trim(),
            role,
            socket.id
        );

        roomService.addParticipant(roomId, participant);
        socket.join(roomId);
        data(socket).roomId = roomId;

        // Send current full state to the joining user.
        socket.emit("sync_state", buildState(room));

        // Broadcast the join to everyone in the room (including the joiner).
        io.to(roomId).emit("user_joined", {
            userId: participant.userId,
            username: participant.username,
            role: participant.role,
            hostId: room.hostId,
            participants: room.getPublicParticipants(),
        });
    });

    // =========================================================
    // leave_room
    // =========================================================
    socket.on("leave_room", (_payload: LeaveRoomPayload) => {
        leaveCurrentRoom(io, socket);
    });

    // =========================================================
    // play
    // =========================================================
    socket.on("play", (payload: PlayPayload) => {
        const ctx = requireParticipant(socket, "play");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canPlay(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "You do not have permission to control playback.",
                "play"
            );
        }

        // Accept optional currentTime from the client for tighter sync.
        let currentTime = room.currentTime;
        if (
            payload &&
            typeof payload.currentTime === "number" &&
            isFinite(payload.currentTime) &&
            payload.currentTime >= 0
        ) {
            currentTime = payload.currentTime;
        }

        roomService.updatePlayback(room.roomId, {
            playState: "playing",
            currentTime,
        });

        broadcastSyncState(io, room);
    });

    // =========================================================
    // pause
    // =========================================================
    socket.on("pause", (payload: PausePayload) => {
        const ctx = requireParticipant(socket, "pause");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canPause(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "You do not have permission to control playback.",
                "pause"
            );
        }

        let currentTime = room.currentTime;
        if (
            payload &&
            typeof payload.currentTime === "number" &&
            isFinite(payload.currentTime) &&
            payload.currentTime >= 0
        ) {
            currentTime = payload.currentTime;
        }

        roomService.updatePlayback(room.roomId, {
            playState: "paused",
            currentTime,
        });

        broadcastSyncState(io, room);
    });

    // =========================================================
    // seek
    // =========================================================
    socket.on("seek", (payload: SeekPayload) => {
        const ctx = requireParticipant(socket, "seek");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canSeek(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "You do not have permission to control playback.",
                "seek"
            );
        }

        const time = payload?.time;
        if (typeof time !== "number" || !isFinite(time) || time < 0) {
            return emitError(
                socket,
                "INVALID_TIME",
                "Seek time must be a non-negative number.",
                "seek"
            );
        }

        roomService.updatePlayback(room.roomId, { currentTime: time });
        broadcastSyncState(io, room);
    });

    // =========================================================
    // change_video
    // =========================================================
    socket.on("change_video", (payload: ChangeVideoPayload) => {
        const ctx = requireParticipant(socket, "change_video");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canChangeVideo(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "You do not have permission to change the video.",
                "change_video"
            );
        }

        const raw = payload?.videoId;
        if (!raw || typeof raw !== "string") {
            return emitError(
                socket,
                "INVALID_VIDEO",
                "A YouTube URL or video ID is required.",
                "change_video"
            );
        }

        const videoId = extractYouTubeVideoId(raw);
        if (!videoId) {
            return emitError(
                socket,
                "INVALID_VIDEO",
                "Invalid YouTube URL or video ID.",
                "change_video"
            );
        }

        roomService.updatePlayback(room.roomId, {
            videoId,
            currentTime: 0,
            playState: "paused",
        });

        broadcastSyncState(io, room);
    });

    // =========================================================
    // assign_role (host only)
    // =========================================================
    socket.on("assign_role", (payload: AssignRolePayload) => {
        const ctx = requireParticipant(socket, "assign_role");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canAssignRole(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "Only the host can assign roles.",
                "assign_role"
            );
        }

        const { userId, role } = payload ?? ({} as AssignRolePayload);
        if (!userId || typeof userId !== "string") {
            return emitError(socket, "USER_NOT_FOUND", "Target user is required.", "assign_role");
        }
        if (role !== "host" && role !== "moderator" && role !== "participant") {
            return emitError(socket, "INVALID_ROLE", "Invalid role.", "assign_role");
        }
        if (role === "host") {
            return emitError(
                socket,
                "INVALID_ROLE",
                "Use transfer_host to change the host.",
                "assign_role"
            );
        }
        if (userId === participant.userId) {
            return emitError(
                socket,
                "INVALID_ROLE",
                "You cannot change your own role.",
                "assign_role"
            );
        }

        const target = room.getParticipant(userId);
        if (!target) {
            return emitError(
                socket,
                "USER_NOT_FOUND",
                "Target user is not in this room.",
                "assign_role"
            );
        }
        if (target.userId === room.hostId) {
            return emitError(
                socket,
                "FORBIDDEN",
                "The host's role cannot be changed here.",
                "assign_role"
            );
        }

        roomService.assignRole(room.roomId, userId, role);

        io.to(room.roomId).emit("role_assigned", {
            userId: target.userId,
            username: target.username,
            role: target.role,
            hostId: room.hostId,
            participants: room.getPublicParticipants(),
        });
    });

    // =========================================================
    // remove_participant (host only)
    // =========================================================
    socket.on("remove_participant", (payload: RemoveParticipantPayload) => {
        const ctx = requireParticipant(socket, "remove_participant");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canRemoveParticipant(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "Only the host can remove participants.",
                "remove_participant"
            );
        }

        const { userId } = payload ?? ({} as RemoveParticipantPayload);
        if (!userId || typeof userId !== "string") {
            return emitError(
                socket,
                "USER_NOT_FOUND",
                "Target user is required.",
                "remove_participant"
            );
        }
        if (userId === room.hostId) {
            return emitError(
                socket,
                "FORBIDDEN",
                "The host cannot be removed.",
                "remove_participant"
            );
        }

        const target = room.getParticipant(userId);
        if (!target) {
            return emitError(
                socket,
                "USER_NOT_FOUND",
                "Target user is not in this room.",
                "remove_participant"
            );
        }

        const targetSocketId = target.socketId;
        const targetSocket = io.sockets.sockets.get(targetSocketId);

        // Remove from room first.
        roomService.removeParticipant(room.roomId, userId);

        // Notify the removed user (before disconnecting them).
        if (targetSocket) {
            targetSocket.emit("participant_removed", {
                userId: target.userId,
                username: target.username,
                participants: room.getPublicParticipants(),
                hostId: room.hostId,
            });
            targetSocket.leave(room.roomId);
            targetSocket.data.roomId = undefined;

            // Disconnect after a small delay to allow the event to flush.
            setTimeout(() => {
                try {
                    targetSocket.disconnect(true);
                } catch {
                    /* ignore */
                }
            }, 200);
        }

        // Broadcast to remaining participants.
        io.to(room.roomId).emit("user_left", {
            userId: target.userId,
            username: target.username,
            participants: room.getPublicParticipants(),
            hostId: room.hostId,
        });
    });

    // =========================================================
    // transfer_host (host only, optional but implemented)
    // =========================================================
    socket.on("transfer_host", (payload: TransferHostPayload) => {
        const ctx = requireParticipant(socket, "transfer_host");
        if (!ctx) return;
        const { participant, room } = ctx;

        if (!permissionService.canTransferHost(participant.role)) {
            return emitError(
                socket,
                "FORBIDDEN",
                "Only the host can transfer host.",
                "transfer_host"
            );
        }

        const { userId } = payload ?? ({} as TransferHostPayload);
        if (!userId || typeof userId !== "string") {
            return emitError(
                socket,
                "USER_NOT_FOUND",
                "Target user is required.",
                "transfer_host"
            );
        }
        if (userId === participant.userId) {
            return emitError(
                socket,
                "INVALID_ROLE",
                "You are already the host.",
                "transfer_host"
            );
        }

        const ok = roomService.transferHost(room.roomId, userId);
        if (!ok) {
            return emitError(
                socket,
                "USER_NOT_FOUND",
                "Target user is not in this room.",
                "transfer_host"
            );
        }

        io.to(room.roomId).emit("host_transferred", {
            previousHostId: participant.userId,
            newHostId: room.hostId,
            hostId: room.hostId,
            participants: room.getPublicParticipants(),
        });
    });

    // =========================================================
    // send_message (chat — available to ALL roles)
    // =========================================================
    socket.on("send_message", (payload: SendMessagePayload) => {
        const ctx = requireParticipant(socket, "send_message");
        if (!ctx) return;
        const { participant, room } = ctx;

        const raw = payload?.message;
        if (!raw || typeof raw !== "string") return;

        const text = raw.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
        if (text.length === 0) return;

        const msg: ChatMessage = {
            id: makeId(),
            userId: participant.userId,
            username: participant.username,
            message: text,
            timestamp: Date.now(),
        };

        // Broadcast to everyone in the room, including the sender.
        io.to(room.roomId).emit("new_message", msg);
    });

    // =========================================================
    // reaction (emoji — available to ALL roles)
    // =========================================================
    socket.on("reaction", (payload: ReactionPayload) => {
        const ctx = requireParticipant(socket, "reaction");
        if (!ctx) return;
        const { participant, room } = ctx;

        const emoji = payload?.emoji;
        if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) return;

        const reaction: ReactionBroadcast = {
            id: makeId(),
            userId: participant.userId,
            username: participant.username,
            emoji,
            timestamp: Date.now(),
        };

        // Broadcast to everyone in the room, including the sender.
        io.to(room.roomId).emit("new_reaction", reaction);
    });

    // =========================================================
    // disconnect
    // =========================================================
    socket.on("disconnect", (reason) => {
        const removed = roomService.removeParticipantBySocket(socket.id);
        if (!removed) return;

        const { participant } = removed;
        const room = roomService.getRoom(removed.room.roomId);
        if (!room) return; // room was deleted (was empty)

        io.to(room.roomId).emit("user_left", {
            userId: participant.userId,
            username: participant.username,
            participants: room.getPublicParticipants(),
            hostId: room.hostId,
        });

        // If the host changed due to this disconnect, broadcast the role change.
        if (participant.role === "host" && room.hostId !== participant.userId) {
            const newHost = room.getParticipant(room.hostId);
            if (newHost) {
                io.to(room.roomId).emit("role_assigned", {
                    userId: newHost.userId,
                    username: newHost.username,
                    role: newHost.role,
                    hostId: room.hostId,
                    participants: room.getPublicParticipants(),
                });
            }
        }

        // eslint-disable-next-line no-console
        console.log(
            `[socket] disconnect ${socket.id} (user=${participant.userId}) reason=${reason}`
        );
    });
}

// ============================================================
//  shared leave helper
// ============================================================
function leaveCurrentRoom(io: TypedServer, socket: TypedSocket): void {
    const removed = roomService.removeParticipantBySocket(socket.id);
    if (!removed) return;

    const { participant } = removed;
    socket.leave(removed.room.roomId);
    socket.data.roomId = undefined;

    const room = roomService.getRoom(removed.room.roomId);
    if (!room) return;

    io.to(room.roomId).emit("user_left", {
        userId: participant.userId,
        username: participant.username,
        participants: room.getPublicParticipants(),
        hostId: room.hostId,
    });

    // If the leaving user was the host and a new host was auto-promoted,
    // broadcast the role change so clients update the UI.
    if (participant.role === "host" && room.hostId !== participant.userId) {
        const newHost = room.getParticipant(room.hostId);
        if (newHost) {
            io.to(room.roomId).emit("role_assigned", {
                userId: newHost.userId,
                username: newHost.username,
                role: newHost.role,
                hostId: room.hostId,
                participants: room.getPublicParticipants(),
            });
        }
    }
}