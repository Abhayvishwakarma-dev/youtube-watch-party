// ============================================================
//  client/src/components/Chat.tsx
//
//  Text chat panel for the room.
//
//  - Shows the last N messages in a scrollable list
//  - Highlights the current user's own messages
//  - Auto-scrolls to the newest message
//  - Sends text via the `send_message` socket event
//    (handled by useWatchParty → party.sendMessage)
//
//  Props come from the Room page, which pulls them from
//  useWatchParty(): messages, currentUserId, sendMessage.
// ============================================================

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

interface Props {
    messages: ChatMessage[];
    currentUserId: string;
    onSend: (text: string) => void;
}

const MAX_LENGTH = 500;

export default function Chat({ messages, currentUserId, onSend }: Props) {
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll to the bottom whenever a new message arrives.
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        // Use rAF so the DOM has time to render the new message first.
        const handle = window.requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
        return () => window.cancelAnimationFrame(handle);
    }, [messages.length]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setDraft("");
    }

    function formatTime(ts: number): string {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }

    return (
        <div className="chat-panel">
            <h2>Chat</h2>

            <div className="chat-messages" ref={listRef}>
                {messages.length === 0 && (
                    <div className="chat-empty">
                        No messages yet. Say hi 👋
                    </div>
                )}

                {messages.map((m) => {
                    const isMe = m.userId === currentUserId;
                    return (
                        <div
                            key={m.id}
                            className={
                                "chat-message" +
                                (isMe ? " chat-message-me" : "")
                            }
                        >
                            <div className="chat-message-header">
                                <span className="chat-username">
                                    {isMe ? "You" : m.username}
                                </span>
                                <span className="chat-time">
                                    {formatTime(m.timestamp)}
                                </span>
                            </div>
                            <div className="chat-text">{m.message}</div>
                        </div>
                    );
                })}
            </div>

            <form className="chat-input-row" onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={MAX_LENGTH}
                />
                <button
                    type="submit"
                    className="primary small"
                    disabled={!draft.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    );
}