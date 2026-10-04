// ============================================================
//  Shared types — mirrors the backend's types/index.ts so that
//  socket event names and payload shapes match exactly.
// ============================================================

export type Role = "host" | "moderator" | "participant";
export type PlayState = "playing" | "paused";

export interface PublicParticipant {
    userId: string;
    username: string;
    role: Role;
}

export interface RoomState {
    roomId: string;
    hostId: string;
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    updatedAt: number;
    participants: PublicParticipant[];
}

export interface ErrorPayload {
    code: string;
    message: string;
    event?: string;
}

// ---------- Client → Server ----------
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

// ---------- Server → Client ----------
export interface UserJoinedPayload {
    userId: string;
    username: string;
    role: Role;
    hostId: string;
    participants: PublicParticipant[];
}

export interface UserLeftPayload {
    userId: string;
    username: string;
    participants: PublicParticipant[];
    hostId: string;
}

export interface RoleAssignedPayload {
    userId: string;
    username: string;
    role: Role;
    hostId: string;
    participants: PublicParticipant[];
}

export interface ParticipantRemovedPayload {
    userId: string;
    username: string;
    participants: PublicParticipant[];
    hostId: string;
}

export interface HostTransferredPayload {
    previousHostId: string;
    newHostId: string;
    hostId: string;
    participants: PublicParticipant[];
}

// ---------- Socket event maps (mirror backend) ----------
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

export interface ServerToClientEvents {
    sync_state: (state: RoomState) => void;
    user_joined: (payload: UserJoinedPayload) => void;
    user_left: (payload: UserLeftPayload) => void;
    role_assigned: (payload: RoleAssignedPayload) => void;
    participant_removed: (payload: ParticipantRemovedPayload) => void;
    host_transferred: (payload: HostTransferredPayload) => void;
    new_message: (payload: ChatMessage) => void;
    new_reaction: (payload: ReactionBroadcast) => void;
    error: (payload: ErrorPayload) => void;
}