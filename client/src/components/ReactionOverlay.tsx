// ============================================================
//  client/src/components/ReactionOverlay.tsx
//
//  Floating emoji animation layer.
//
//  Renders one floating emoji per active reaction. The parent
//  (Room.tsx) mounts this INSIDE the YouTube player wrapper so
//  the emojis float up over the video.
//
//  - `pointer-events: none` on the layer → clicks pass through
//    to the video below.
//  - Each emoji auto-removes after ~3s — that cleanup is done
//    in useWatchParty.ts (setTimeout on the hook side), NOT here.
//    This component just renders whatever it's given.
//
//  Props:
//    reactions  →  party.reactions  (ReactionBroadcast[])
// ============================================================

import type { ReactionBroadcast } from "../types";

interface Props {
    reactions: ReactionBroadcast[];
}

export default function ReactionOverlay({ reactions }: Props) {
    return (
        <div className="reaction-overlay">
            {reactions.map((r, i) => (
                <div
                    key={r.id}
                    className="reaction-float"
                    style={{
                        // Stagger horizontally so multiple reactions
                        // don't stack exactly on top of each other.
                        left: `${10 + ((i * 13) % 70)}%`,
                        // Slight vertical offset for variety.
                        animationDelay: `${(i % 3) * 0.08}s`,
                    }}
                >
                    <div className="reaction-emoji">{r.emoji}</div>
                    <div className="reaction-name">{r.username}</div>
                </div>
            ))}
        </div>
    );
}