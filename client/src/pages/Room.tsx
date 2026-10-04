// ============================================================
//  Room page — main watch party screen.
//  Composes: header, YouTube player, controls, video input,
//  participant list, chat, reactions.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RoomHeader from "../components/RoomHeader";
import YouTubePlayer from "../components/YouTubePlayer";
import PlaybackControls from "../components/PlaybackControls";
import VideoInput from "../components/VideoInput";
import ParticipantList from "../components/ParticipantList";
import Chat from "../components/Chat";
import ReactionBar from "../components/ReactionBar";
import ReactionOverlay from "../components/ReactionOverlay";
import { useWatchParty } from "../hooks/useWatchParty";

const USERNAME_KEY = "watch-party:username";

export default function Room() {
    const { roomId = "" } = useParams<{ roomId: string }>();
    const navigate = useNavigate();

    // If the user opened /room/XXXX directly, they still need a username.
    // Prompt once, then proceed.
    const [username, setUsername] = useState<string>(
        () => localStorage.getItem(USERNAME_KEY) ?? ""
    );

    useEffect(() => {
        if (!username) {
            const input = window.prompt(
                "Enter a username to join this room:"
            );
            const trimmed = (input ?? "").trim().slice(0, 30);
            if (!trimmed) {
                navigate("/", { replace: true });
                return;
            }
            localStorage.setItem(USERNAME_KEY, trimmed);
            setUsername(trimmed);
        }
    }, [username, navigate]);

    if (!username) {
        return <div className="loading-screen">Joining room…</div>;
    }

    return <RoomInner roomId={roomId} username={username} />;
}

// ---------- Actual room UI ----------
function RoomInner({
    roomId,
    username,
}: {
    roomId: string;
    username: string;
}) {
    const party = useWatchParty(roomId, username);

    // Latest videoId passed to the player. The player refs its own
    // instance internally; we only need the id + state props here.
    const playerRef = useRef<any>(null);
    const [displayTime, setDisplayTime] = useState(party.currentTime);

    // Keep the on-screen timer in sync when the server state changes.
    useEffect(() => {
        setDisplayTime(party.currentTime);
    }, [party.currentTime]);

    const handleLocalPlay = useMemo(
        () => (t: number) => {
            if (!party.canControl) return;
            party.play(t);
        },
        [party]
    );

    const handleLocalPause = useMemo(
        () => (t: number) => {
            if (!party.canControl) return;
            party.pause(t);
        },
        [party]
    );

    const handleLocalSeek = useMemo(
        () => (t: number) => {
            if (!party.canControl) return;
            party.seek(t);
        },
        [party]
    );

    if (!party.joined) {
        return (
            <div className="loading-screen">
                {party.connected ? "Joining room…" : "Connecting…"}
            </div>
        );
    }

    return (
        <div className="room-page">
            <RoomHeader roomId={roomId} onLeave={party.leave} />

            {party.error && (
                <div className="home-error" style={{ marginBottom: 16 }}>
                    {party.error}
                </div>
            )}

            <div className="room-layout">
                <div className="main-column">
                    {/* Player + floating emoji overlay share the same
                        positioned wrapper so reactions float over the video. */}
                    <div style={{ position: "relative" }}>
                        <YouTubePlayer
                            videoId={party.videoId}
                            currentTime={party.currentTime}
                            playState={party.playState}
                            canControl={party.canControl}
                            onLocalPlay={handleLocalPlay}
                            onLocalPause={handleLocalPause}
                            onLocalSeek={handleLocalSeek}
                            onReady={(p) => {
                                playerRef.current = p;
                            }}
                            onTimeUpdate={(t) => setDisplayTime(t)}
                        />
                        <ReactionOverlay reactions={party.reactions} />
                    </div>

                    <PlaybackControls
                        currentTime={displayTime}
                        playState={party.playState}
                        canControl={party.canControl}
                        onPlay={() => party.play(displayTime)}
                        onPause={() => party.pause(displayTime)}
                        onSeek={(t) => party.seek(t)}
                    />

                    <ReactionBar onReact={party.sendReaction} />

                    <div className="controls">
                        <VideoInput
                            canControl={party.canControl}
                            onChangeVideo={(raw) => party.changeVideo(raw)}
                        />
                        {!party.canControl && (
                            <div className="notice">
                                Only the host or a moderator can change the
                                video.
                            </div>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        minWidth: 0,
                    }}
                >
                    <ParticipantList
                        participants={party.participants}
                        currentUserId={party.currentUserId}
                        hostId={party.hostId}
                        isHost={party.isHost}
                        onMakeModerator={(id) =>
                            party.assignRole(id, "moderator")
                        }
                        onMakeParticipant={(id) =>
                            party.assignRole(id, "participant")
                        }
                        onRemove={(id) => party.removeParticipant(id)}
                        onTransferHost={(id) => party.transferHost(id)}
                    />

                    <Chat
                        messages={party.messages}
                        currentUserId={party.currentUserId}
                        onSend={party.sendMessage}
                    />
                </div>
            </div>
        </div>
    );
}