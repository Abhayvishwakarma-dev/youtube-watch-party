// ============================================================
//  Top bar: app name, room code, copy-link, leave button.
// ============================================================

import { useState } from "react";

interface Props {
    roomId: string;
    onLeave: () => void;
}

export default function RoomHeader({ roomId, onLeave }: Props) {
    const [copied, setCopied] = useState(false);

    function copyLink() {
        const url = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard
            .writeText(url)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
            })
            .catch(() => {
                // Fallback: prompt
                window.prompt("Copy this link:", url);
            });
    }

    return (
        <header className="room-header">
            <div>
                <span className="title">YouTube Watch Party</span>
                <span className="room-code">
                    Room: <strong>{roomId}</strong>
                </span>
            </div>
            <div className="actions">
                <button className="small" onClick={copyLink}>
                    {copied ? "Copied!" : "Copy Invite Link"}
                </button>
                <button
                    className="small"
                    onClick={onLeave}
                    style={{ background: "var(--danger)", color: "white" }}
                >
                    Leave
                </button>
            </div>
        </header>
    );
}