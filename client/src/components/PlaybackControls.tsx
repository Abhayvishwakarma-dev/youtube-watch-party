// ============================================================
//  Play / Pause / Seek controls.
//  Buttons are disabled for participants (RBAC on the UI side).
//  The backend enforces the same rules regardless.
// ============================================================

import { useState } from "react";
import type { PlayState } from "../types";

interface Props {
    currentTime: number;
    playState: PlayState;
    canControl: boolean;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    const ss = String(r).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function PlaybackControls({
    currentTime,
    playState,
    canControl,
    onPlay,
    onPause,
    onSeek,
}: Props) {
    const [seekTarget, setSeekTarget] = useState<string>("");

    function handleSeekSubmit(e: React.FormEvent) {
        e.preventDefault();
        const parts = seekTarget.split(":").map((p) => p.trim());
        let seconds = 0;

        if (parts.length === 1) {
            seconds = Number(parts[0]);
        } else if (parts.length === 2) {
            seconds = Number(parts[0]) * 60 + Number(parts[1]);
        } else if (parts.length === 3) {
            seconds =
                Number(parts[0]) * 3600 +
                Number(parts[1]) * 60 +
                Number(parts[2]);
        }

        if (!isFinite(seconds) || seconds < 0) return;
        onSeek(seconds);
        setSeekTarget("");
    }

    return (
        <div className="controls">
            <div className="controls-row">
                <button
                    className="primary"
                    onClick={onPlay}
                    disabled={!canControl || playState === "playing"}
                >
                    ▶ Play
                </button>
                <button
                    onClick={onPause}
                    disabled={!canControl || playState === "paused"}
                >
                    ⏸ Pause
                </button>
                <span className="time">
                    now: {formatTime(currentTime)} · state: {playState}
                </span>
            </div>

            <form className="controls-row" onSubmit={handleSeekSubmit}>
                <input
                    type="text"
                    placeholder="Seek to (mm:ss or hh:mm:ss or seconds)"
                    value={seekTarget}
                    onChange={(e) => setSeekTarget(e.target.value)}
                    disabled={!canControl}
                    style={{ maxWidth: 320 }}
                />
                <button
                    type="submit"
                    className="small"
                    disabled={!canControl || !seekTarget.trim()}
                >
                    Seek
                </button>
            </form>

            {!canControl && (
                <div className="notice">
                    You are a participant. Only the host or a moderator can
                    control playback.
                </div>
            )}
        </div>
    );
}