// ============================================================
//  One row in the participant list.
//  Shows username, role badge, and (host-only) actions.
// ============================================================

import type { PublicParticipant, Role } from "../types";

interface Props {
    participant: PublicParticipant;
    isSelf: boolean;
    isHost: boolean;        // is the CURRENT user the host?
    isRoomHost: boolean;    // is this participant the room host?
    onMakeModerator: (userId: string) => void;
    onMakeParticipant: (userId: string) => void;
    onRemove: (userId: string) => void;
    onTransferHost: (userId: string) => void;   // ← NEW
}

const ROLE_LABEL: Record<Role, string> = {
    host: "HOST",
    moderator: "MODERATOR",
    participant: "PARTICIPANT",
};

export default function ParticipantItem({
    participant,
    isSelf,
    isHost,
    isRoomHost,
    onMakeModerator,
    onMakeParticipant,
    onRemove,
    onTransferHost,   // ← NEW
}: Props) {
    const showActions = isHost && !isSelf && !isRoomHost;

    return (
        <div className="participant-item">
            <div className="info">
                <div className="username">
                    {participant.username}
                    {isSelf && <span className="you">(you)</span>}
                </div>
                <div className={`role ${participant.role}`}>
                    {ROLE_LABEL[participant.role]}
                </div>
            </div>

            {showActions && (
                <div className="item-actions">
                    {participant.role === "participant" && (
                        <button
                            className="small"
                            onClick={() => onMakeModerator(participant.userId)}
                        >
                            Promote
                        </button>
                    )}
                    {participant.role === "moderator" && (
                        <button
                            className="small"
                            onClick={() => onMakeParticipant(participant.userId)}
                        >
                            Demote
                        </button>
                    )}

                    {/* Make Host button — transfers host role with confirmation */}
                    <button
                        className="small"
                        onClick={() => {
                            const ok = window.confirm(
                                `Make ${participant.username} the host? You will become a participant and lose host controls.`
                            );
                            if (ok) {
                                onTransferHost(participant.userId);
                            }
                        }}
                        style={{ background: "#8a6d00", color: "white" }}
                    >
                        Make Host
                    </button>

                    <button
                        className="small"
                        onClick={() => onRemove(participant.userId)}
                        style={{ background: "var(--danger)", color: "white" }}
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>
    );
}