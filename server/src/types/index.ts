// ============================================================
//  server/src/types/index.ts
//
//  Shared types for the backend. Mirrored on the frontend at
//  client/src/types/index.ts (must stay in sync).
// ============================================================

// Role definitions
export type Role = "host" | "moderator" | "participant";

// Playback state
export type PlayState = "playing" | "paused";

// Public-facing participant (safe to broadcast)
export interface PublicParticipant {
    userId: string;
    username: string;
    role: Role;
}

// Internal participant (includes socketId)
export interface Participant extends PublicParticipant {
    socketId: string;
}

// Full synchronized room state sent to clients
export interface RoomState {
    roomId: string;
    hostId: string;
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    updatedAt: number;
    participants: PublicParticipant[];
}

// Playback state only
export interface PlaybackState {
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    updatedAt: number;
}

// Error payload sent to client
export interface ErrorPayload {
    code: string;
    message: string;
    event?: string;
}

// ---------- Client -> Server payloads ----------
export interface JoinRoomPayload {
    roomId: string;
    username: string;
}

export interface LeaveRoomPayload {
    roomId: string;
}

export interface PlayPayload {
    roomId: string;
    currentTime?: number;
}

export interface PausePayload {
    roomId: string;
    currentTime?: number;
}

export interface SeekPayload {
    roomId: string;
    time: number;
}

export interface ChangeVideoPayload {
    roomId: string;
    videoId: string;
}

export interface AssignRolePayload {
    roomId: string;
    userId: string;
    role: Role;
}

export interface RemoveParticipantPayload {
    roomId: string;
    userId: string;
}

export interface TransferHostPayload {
    roomId: string;
    userId: string;
}

// ---------- Chat ----------
export interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    message: string;
    timestamp: number;
}

export interface SendMessagePayload {
    roomId: string;
    message: string;
}

// ---------- Reactions ----------
export type ReactionEmoji = "👍" | "❤️" | "😂" | "🔥" | "👏";

export interface ReactionPayload {
    roomId: string;
    emoji: ReactionEmoji;
}

export interface ReactionBroadcast {
    id: string;
    userId: string;
    username: string;
    emoji: ReactionEmoji;
    timestamp: number;
}

// ---------- Socket handshake auth ----------
export interface SocketAuth {
    userId?: string;
}

// ---------- Socket data stored on each socket ----------
export interface SocketData {
    userId: string;
    roomId?: string;
}