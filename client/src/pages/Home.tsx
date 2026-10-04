// ============================================================
//  Home page: create room OR join room by code.
//  Persists the username in localStorage for convenience.
//
//  Backend URL comes from getBackendUrl() — VITE_API_URL is
//  optional (see client/src/services/socket.ts for the
//  resolution logic: env var → localhost:5000 → Render URL).
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getOrCreateUserId,
    setUserId,
    getBackendUrl,
} from "../services/socket";

const USERNAME_KEY = "watch-party:username";

export default function Home() {
    const navigate = useNavigate();
    const [username, setUsername] = useState(
        () => localStorage.getItem(USERNAME_KEY) ?? ""
    );
    const [joinCode, setJoinCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    function persistUsername(): boolean {
        const trimmed = username.trim();
        if (!trimmed) {
            setError("Please enter a username.");
            return false;
        }
        if (trimmed.length > 30) {
            setError("Username must be 30 characters or fewer.");
            return false;
        }
        localStorage.setItem(USERNAME_KEY, trimmed);
        return true;
    }

    async function handleCreate() {
        if (!persistUsername()) return;
        setBusy(true);
        setError(null);

        try {
            // Resolve backend URL at call time via the shared helper.
            const API_URL = getBackendUrl();

            const res = await fetch(`${API_URL}/api/rooms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim() }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to create room");
            }

            const data: { roomId: string; hostId: string } = await res.json();

            // Store the hostId as our userId so the backend recognises us
            // as host when we join via socket.
            setUserId(data.hostId);

            navigate(`/room/${data.roomId}`);
        } catch (e: any) {
            setError(e?.message ?? "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    function handleJoin() {
        if (!persistUsername()) return;
        const code = joinCode.trim().toUpperCase();
        if (!code) {
            setError("Please enter a room code.");
            return;
        }
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            setError("Room codes are 6 characters (A–Z, 0–9).");
            return;
        }
        // Ensure we have a userId — but do NOT overwrite an existing one,
        // because the host might be joining their own room from another tab.
        getOrCreateUserId();
        navigate(`/room/${code}`);
    }

    return (
        <div className="home">
            <div className="home-card">
                <h1>YouTube Watch Party</h1>
                <p className="subtitle">
                    Watch YouTube in perfect sync with friends.
                </p>

                <label>Username</label>
                <input
                    type="text"
                    placeholder="e.g. Abhay"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={30}
                />

                <div className="row">
                    <button
                        className="primary"
                        onClick={handleCreate}
                        disabled={busy}
                        style={{ width: "100%" }}
                    >
                        {busy ? "Creating…" : "Create Room"}
                    </button>
                </div>

                <div className="divider">OR</div>

                <label>Room Code</label>
                <input
                    type="text"
                    placeholder="e.g. ABC123"
                    value={joinCode}
                    onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    maxLength={6}
                />

                <div className="row">
                    <button onClick={handleJoin} style={{ width: "100%" }}>
                        Join Room
                    </button>
                </div>

                {error && <div className="home-error">{error}</div>}
            </div>
        </div>
    );
}