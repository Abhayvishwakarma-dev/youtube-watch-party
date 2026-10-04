// ============================================================
//  Central hook that owns:
//    - the Socket.IO lifecycle for a room
//    - the room state (videoId, currentTime, playState)
//    - the participant list and current user
//    - chat messages and reactions
//    - emitted actions (play, pause, seek, change_video, …)
//
//  This is the single source of truth for the Room page.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, getOrCreateUserId } from "../services/socket";
import type {
    ChatMessage,
    ErrorPayload,
    PlayState,
    PublicParticipant,
    ReactionBroadcast,
    ReactionEmoji,
    Role,
    RoomState,
} from "../types";

export interface UseWatchPartyResult {
    connected: boolean;
    joined: boolean;
    roomId: string;
    hostId: string;
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    participants: PublicParticipant[];
    currentUserId: string;
    currentRole: Role | null;
    canControl: boolean;
    isHost: boolean;
    error: string | null;
    messages: ChatMessage[];
    reactions: ReactionBroadcast[];
    // Actions
    play: (currentTime?: number) => void;
    pause: (currentTime?: number) => void;
    seek: (time: number) => void;
    changeVideo: (raw: string) => void;
    assignRole: (userId: string, role: Role) => void;
    removeParticipant: (userId: string) => void;
    transferHost: (userId: string) => void;
    sendMessage: (text: string) => void;
    sendReaction: (emoji: ReactionEmoji) => void;
    leave: () => void;
}

export function useWatchParty(
    roomId: string,
    username: string
): UseWatchPartyResult {
    const navigate = useNavigate();
    const userId = getOrCreateUserId();

    const [connected, setConnected] = useState(false);
    const [joined, setJoined] = useState(false);
    const [hostId, setHostId] = useState<string>("");
    const [videoId, setVideoId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [playState, setPlayState] = useState<PlayState>("paused");
    const [participants, setParticipants] = useState<PublicParticipant[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [reactions, setReactions] = useState<ReactionBroadcast[]>([]);

    // Prevent duplicate joins on React StrictMode double-invoke.
    const joinedOnceRef = useRef(false);

    // ---------- Wire socket listeners once ----------
    useEffect(() => {
        if (!roomId || !username) return;

        function onConnect() {
            setConnected(true);
            if (!joinedOnceRef.current) {
                joinedOnceRef.current = true;
                socket.emit("join_room", { roomId, username });
            }
        }

        function onDisconnect() {
            setConnected(false);
        }

        function onSyncState(state: RoomState) {
            setHostId(state.hostId);
            setVideoId(state.videoId);
            setCurrentTime(state.currentTime);
            setPlayState(state.playState);
            setParticipants(state.participants);
            setJoined(true);
        }

        function onUserJoined(payload: {
            hostId: string;
            participants: PublicParticipant[];
        }) {
            setHostId(payload.hostId);
            setParticipants(payload.participants);
        }

        function onUserLeft(payload: {
            hostId: string;
            participants: PublicParticipant[];
        }) {
            setHostId(payload.hostId);
            setParticipants(payload.participants);
        }

        function onRoleAssigned(payload: {
            hostId: string;
            participants: PublicParticipant[];
        }) {
            setHostId(payload.hostId);
            setParticipants(payload.participants);
        }

        function onParticipantRemoved(payload: {
            userId: string;
            participants: PublicParticipant[];
        }) {
            if (payload.userId === userId) {
                // We were removed → kick out.
                socket.disconnect();
                navigate("/", { replace: true });
                return;
            }
            setParticipants(payload.participants);
        }

        function onHostTransferred(payload: {
            hostId: string;
            participants: PublicParticipant[];
        }) {
            setHostId(payload.hostId);
            setParticipants(payload.participants);
        }

        function onError(payload: ErrorPayload) {
            setError(`${payload.code}: ${payload.message}`);
            window.setTimeout(() => setError(null), 5000);
        }

        // ---------- Chat ----------
        function onNewMessage(msg: ChatMessage) {
            setMessages((prev) => {
                const next = [...prev, msg];
                // Keep only the last 100 messages in memory.
                return next.length > 100 ? next.slice(-100) : next;
            });
        }

        // ---------- Reactions ----------
        function onNewReaction(r: ReactionBroadcast) {
            setReactions((prev) => [...prev, r]);

            // Auto-remove this reaction after its float animation ends (~3s).
            window.setTimeout(() => {
                setReactions((prev) => prev.filter((x) => x.id !== r.id));
            }, 3000);
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("sync_state", onSyncState);
        socket.on("user_joined", onUserJoined);
        socket.on("user_left", onUserLeft);
        socket.on("role_assigned", onRoleAssigned);
        socket.on("participant_removed", onParticipantRemoved);
        socket.on("host_transferred", onHostTransferred);
        socket.on("error", onError);
        socket.on("new_message", onNewMessage);
        socket.on("new_reaction", onNewReaction);

        if (!socket.connected) {
            socket.connect();
        } else {
            onConnect();
        }

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("sync_state", onSyncState);
            socket.off("user_joined", onUserJoined);
            socket.off("user_left", onUserLeft);
            socket.off("role_assigned", onRoleAssigned);
            socket.off("participant_removed", onParticipantRemoved);
            socket.off("host_transferred", onHostTransferred);
            socket.off("error", onError);
            socket.off("new_message", onNewMessage);
            socket.off("new_reaction", onNewReaction);

            // Leave the room but keep the socket open for future use.
            if (socket.connected) {
                socket.emit("leave_room", { roomId });
            }
            joinedOnceRef.current = false;
        };
    }, [roomId, username, navigate, userId]);

    // ---------- Derived role / permission ----------
    const me = participants.find((p) => p.userId === userId) ?? null;
    const currentRole = me?.role ?? null;
    const isHost = currentRole === "host";
    const canControl =
        currentRole === "host" || currentRole === "moderator";

    // ---------- Actions ----------
    const play = useCallback(
        (time?: number) => {
            socket.emit("play", { roomId, currentTime: time });
        },
        [roomId]
    );

    const pause = useCallback(
        (time?: number) => {
            socket.emit("pause", { roomId, currentTime: time });
        },
        [roomId]
    );

    const seek = useCallback(
        (time: number) => {
            socket.emit("seek", { roomId, time });
        },
        [roomId]
    );

    const changeVideo = useCallback(
        (raw: string) => {
            socket.emit("change_video", { roomId, videoId: raw });
        },
        [roomId]
    );

    const assignRole = useCallback(
        (targetId: string, role: Role) => {
            socket.emit("assign_role", { roomId, userId: targetId, role });
        },
        [roomId]
    );

    const removeParticipant = useCallback(
        (targetId: string) => {
            socket.emit("remove_participant", { roomId, userId: targetId });
        },
        [roomId]
    );

    const transferHost = useCallback(
        (targetId: string) => {
            socket.emit("transfer_host", { roomId, userId: targetId });
        },
        [roomId]
    );

    const sendMessage = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            socket.emit("send_message", { roomId, message: trimmed });
        },
        [roomId]
    );

    const sendReaction = useCallback(
        (emoji: ReactionEmoji) => {
            socket.emit("reaction", { roomId, emoji });
        },
        [roomId]
    );

    const leave = useCallback(() => {
        if (socket.connected) {
            socket.emit("leave_room", { roomId });
        }
        socket.disconnect();
        navigate("/", { replace: true });
    }, [roomId, navigate]);

    return {
        connected,
        joined,
        roomId,
        hostId,
        videoId,
        currentTime,
        playState,
        participants,
        currentUserId: userId,
        currentRole,
        canControl,
        isHost,
        error,
        messages,
        reactions,
        play,
        pause,
        seek,
        changeVideo,
        assignRole,
        removeParticipant,
        transferHost,
        sendMessage,
        sendReaction,
        leave,
    };
}