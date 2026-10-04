// ============================================================
//  server/src/types/index.ts
//
//  Shared types for the backend. Mirrored on the frontend at
//  client/src/types/index.ts (must stay in sync).
// ============================================================

// ---------- Roles ----------
export type Role = "host" | "moderator" | "participant";

// ---------- Playback state ----------
export type PlayState = "playing" | "paused";

// ============================================================
//  Users / Auth
// ============================================================

/** Public shape of a user — safe to send to clients. */
export interface PublicUser {
    userId: string;
    username: string;
    email: string;
}

/** JWT payload signed by utils/jwt.ts's signToken(). */
export interface JwtPayload {
    userId: string;
    username: string;
    email: string;
}

/** Decoded JWT includes standard claims added by jsonwebtoken. */
export interface DecodedJwt extends JwtPayload {
    iat: number;
    exp: number;
}

/** Auth error codes used by AuthService + authRoutes. */
export type AuthErrorCode =
    | "INVALID_USERNAME"
    | "INVALID_EMAIL"
    | "INVALID_PASSWORD"
    | "INVALID_CREDENTIALS"
    | "USERNAME_TAKEN"
    | "EMAIL_TAKEN"
    | "USER_NOT_FOUND"
    | "UNAUTHORIZED"
    | "DB_ERROR";

/** Shape of a successful register/login response. */
export interface AuthResult {
    user: PublicUser;
    token: string;
}

// ============================================================
//  Participants
// ============================================================

/** Public-facing participant (safe to broadcast). */
export interface PublicParticipant {
    userId: string;
    username: string;
    role: Role;
}

/** Internal participant (includes socketId). */
export interface Participant extends PublicParticipant {
    socketId: string;
}

// ============================================================
//  Room state
// ============================================================

/** Full synchronized room state sent to clients. */
export interface RoomState {
    roomId: string;
    hostId: string;
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    updatedAt: number;
    participants: PublicParticipant[];
}

/** Playback state only. */
export interface PlaybackState {
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    updatedAt: number;
}

// ============================================================
//  Errors
// ============================================================

/** Error payload sent to the client over Socket.IO. */
export interface ErrorPayload {
    code: string;
    message: string;
    event?: string;
}

// ============================================================
//  Client → Server socket payloads
// ============================================================

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

// ============================================================
//  Chat
// ============================================================

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

// ============================================================
//  Reactions
// ============================================================

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

// ============================================================
//  Socket handshake auth
// ============================================================

/**
 * Auth data sent by the client during the Socket.IO handshake.
 *
 * `token` — JWT issued by /api/auth/register or /api/auth/login.
 *           Preferred.
 *
 * `userId` — LEGACY. Kept for backwards-compatibility during the
 *            migration. Once the frontend switches fully to JWT,
 *            this can be removed.
 */
export interface SocketAuth {
    token?: string;
    userId?: string;
}

// ============================================================
//  Socket data (per-connection state)
// ============================================================

/**
 * Data attached to each socket in `socket.data`.
 *
 * - `userId`   — verified user id (from JWT payload when
 *                authentication succeeded).
 * - `username` — verified username.
 * - `email`    — verified email (optional; not used in RBAC).
 * - `roomId`   — set after a successful `join_room`.
 */
export interface SocketData {
    userId: string;
    username?: string;
    email?: string;
    roomId?: string;
}