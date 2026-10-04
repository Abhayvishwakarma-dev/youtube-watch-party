// ============================================================
//  client/src/pages/Home.tsx
//
//  Home page — create room OR join room by code.
//
//  Auth integration:
//    - Username comes from useAuth().user (no manual input)
//    - JWT token is sent in the Authorization header on
//      POST /api/rooms so the backend can identify the host
//    - Logout button clears the session
//
//  Backend URL comes from getBackendUrl() — VITE_API_URL is
//  optional (see client/src/services/socket.ts for the
//  resolution logic: env var → localhost:5000 → Render URL).
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getBackendUrl } from "../services/socket";
import { getToken } from "../utils/storage";

export default function Home() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [joinCode, setJoinCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // ProtectedRoute guarantees `user` is non-null here, but guard
    // anyway in case this component is ever rendered outside it.
    if (!user) {
        return (
            <div className="loading-screen">
                Redirecting…
            </div>
        );
    }

    // ----------------------------------------------------------
    //  Create room
    // ----------------------------------------------------------
    async function handleCreate() {
        setBusy(true);
        setError(null);

        try {
            const API_URL = getBackendUrl();
            const token = getToken();

            const res = await fetch(`${API_URL}/api/rooms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ username: user!.username }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    (data as any)?.message ??
                        (data as any)?.error ??
                        "Failed to create room"
                );
            }

            const data: { roomId: string; hostId: string } =
                await res.json();

            navigate(`/room/${data.roomId}`);
        } catch (e: any) {
            setError(e?.message ?? "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    // ----------------------------------------------------------
    //  Join room by code
    // ----------------------------------------------------------
    function handleJoin() {
        const code = joinCode.trim().toUpperCase();
        if (!code) {
            setError("Please enter a room code.");
            return;
        }
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            setError("Room codes are 6 characters (A–Z, 0–9).");
            return;
        }
        navigate(`/room/${code}`);
    }

    // ----------------------------------------------------------
    //  Logout
    // ----------------------------------------------------------
    function handleLogout() {
        if (window.confirm("Log out?")) {
            logout();
            navigate("/login", { replace: true });
        }
    }

    // ----------------------------------------------------------
    //  Render
    // ----------------------------------------------------------
    return (
        <div className="home">
            <div className="home-card">
                <h1>YouTube Watch Party</h1>
                <p className="subtitle">
                    Watch YouTube in perfect sync with friends.
                </p>

                {/* ---------- Signed-in user bar ---------- */}
                <div className="user-bar">
                    <div className="user-info">
                        <span className="user-label">Signed in as</span>
                        <span className="user-name">{user.username}</span>
                    </div>
                    <button
                        className="small"
                        onClick={handleLogout}
                        style={{
                            background: "transparent",
                            border: "1px solid var(--border)",
                            color: "var(--text-dim)",
                        }}
                    >
                        Log out
                    </button>
                </div>

                <div className="divider">CREATE</div>

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

                {/* ---------- Join by code ---------- */}
                <label>Room Code</label>
                <input
                    type="text"
                    placeholder="e.g. ABC123"
                    value={joinCode}
                    onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    maxLength={6}
                    disabled={busy}
                />

                <div className="row">
                    <button
                        onClick={handleJoin}
                        style={{ width: "100%" }}
                        disabled={busy}
                    >
                        Join Room
                    </button>
                </div>

                {error && <div className="home-error">{error}</div>}
            </div>
        </div>
    );
}