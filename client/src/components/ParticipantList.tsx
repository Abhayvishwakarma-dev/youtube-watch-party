// ============================================================
//  Participant list container.
//  Renders one ParticipantItem per person in the room.
// ============================================================

import type { PublicParticipant } from "../types";
import ParticipantItem from "./ParticipantItem";

interface Props {
    participants: PublicParticipant[];
    currentUserId: string;
    hostId: string;
    isHost: boolean;
    onMakeModerator: (userId: string) => void;
    onMakeParticipant: (userId: string) => void;
    onRemove: (userId: string) => void;
    onTransferHost: (userId: string) => void;   // ← NEW
}

export default function ParticipantList({
    participants,
    currentUserId,
    hostId,
    isHost,
    onMakeModerator,
    onMakeParticipant,
    onRemove,
    onTransferHost,   // ← NEW
}: Props) {
    // Sort: host first, then moderators, then participants.
    const order = { host: 0, moderator: 1, participant: 2 };
    const sorted = [...participants].sort(
        (a, b) => order[a.role] - order[b.role]
    );

    return (
        <div className="participants">
            <h2>Participants ({sorted.length})</h2>
            {sorted.map((p) => (
                <ParticipantItem
                    key={p.userId}
                    participant={p}
                    isSelf={p.userId === currentUserId}
                    isHost={isHost}
                    isRoomHost={p.userId === hostId}
                    onMakeModerator={onMakeModerator}
                    onMakeParticipant={onMakeParticipant}
                    onRemove={onRemove}
                    onTransferHost={onTransferHost}   
                />
            ))}
        </div>
    );
}