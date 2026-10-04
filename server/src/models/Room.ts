import { Participant } from "./Participant";
import { PlayState, PublicParticipant, Role, RoomState } from "../types";

export class Room {
    public participants: Map<string, Participant> = new Map();

    public videoId: string | null = null;
    public currentTime: number = 0;
    public playState: PlayState = "paused";
    public updatedAt: number = Date.now();
    public createdAt: Date = new Date();

    constructor(public roomId: string, public hostId: string) {}

    addParticipant(participant: Participant): void {
        this.participants.set(participant.userId, participant);
    }

    removeParticipant(userId: string): Participant | undefined {
        const p = this.participants.get(userId);
        if (p) this.participants.delete(userId);
        return p;
    }

    getParticipant(userId: string): Participant | undefined {
        return this.participants.get(userId);
    }

    getParticipantBySocket(socketId: string): Participant | undefined {
        for (const p of this.participants.values()) {
            if (p.socketId === socketId) return p;
        }
        return undefined;
    }

    /**
     * Assigns a new role. The host's role cannot be changed via this method
     * (use transferHost instead).
     */
    assignRole(userId: string, role: Role): boolean {
        const p = this.participants.get(userId);
        if (!p) return false;
        if (p.userId === this.hostId && role !== "host") return false;
        p.role = role;
        return true;
    }

    /**
     * Transfer host privileges. The old host is demoted to participant.
     * The new host must already be in the room.
     */
    transferHost(newHostUserId: string): boolean {
        const newHost = this.participants.get(newHostUserId);
        if (!newHost) return false;
        if (newHostUserId === this.hostId) return false;

        const oldHost = this.participants.get(this.hostId);
        if (oldHost) oldHost.role = "participant";

        newHost.role = "host";
        this.hostId = newHostUserId;
        return true;
    }

    updatePlayback(updates: {
        videoId?: string | null;
        currentTime?: number;
        playState?: PlayState;
    }): void {
        if (updates.videoId !== undefined) this.videoId = updates.videoId;
        if (updates.currentTime !== undefined) this.currentTime = updates.currentTime;
        if (updates.playState !== undefined) this.playState = updates.playState;
        this.updatedAt = Date.now();
    }

    getParticipants(): Participant[] {
        return Array.from(this.participants.values());
    }

    getPublicParticipants(): PublicParticipant[] {
        return this.getParticipants().map((p) => p.toPublic());
    }

    isEmpty(): boolean {
        return this.participants.size === 0;
    }

    toState(): RoomState {
        return {
            roomId: this.roomId,
            hostId: this.hostId,
            videoId: this.videoId,
            currentTime: this.currentTime,
            playState: this.playState,
            updatedAt: this.updatedAt,
            participants: this.getPublicParticipants(),
        };
    }
}