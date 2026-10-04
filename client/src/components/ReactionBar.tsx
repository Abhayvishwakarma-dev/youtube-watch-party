// ============================================================
//  client/src/components/ReactionBar.tsx
//
//  A row of emoji buttons. When clicked, sends the chosen emoji
//  as a "reaction" socket event. The server broadcasts it back
//  to everyone in the room as "new_reaction", and the floating
//  overlay (ReactionOverlay.tsx) animates them upward.
//
//  - Available to ALL roles (participants included)
//  - Emoji list must match ALLOWED_REACTIONS on the backend
//    (server/src/socket/eventHandlers.ts)
//
//  Props:
//    onReact(emoji)  →  useWatchParty → party.sendReaction
// ============================================================

import type { ReactionEmoji } from "../types";

interface Props {
    onReact: (emoji: ReactionEmoji) => void;
}

// Keep this list in sync with ALLOWED_REACTIONS on the server.
const EMOJIS: ReactionEmoji[] = ["👍", "❤️", "😂", "🔥", "👏"];

export default function ReactionBar({ onReact }: Props) {
    return (
        <div className="reaction-bar">
            {EMOJIS.map((emoji) => (
                <button
                    key={emoji}
                    type="button"
                    className="reaction-btn"
                    onClick={() => onReact(emoji)}
                    title={`React ${emoji}`}
                    aria-label={`React ${emoji}`}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}