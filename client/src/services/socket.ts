// ============================================================
//  client/src/services/socket.ts
//
//  Single, shared Socket.IO connection.
//
//  Backend URL resolution:
//    1. import.meta.env.VITE_API_URL  (if set in .env or Vercel)
//    2. http://localhost:5000         (when running locally)
//    3. https://youtube-watch-party-lmwi.onrender.com  (production fallback)
//
//  So VITE_API_URL is OPTIONAL. Leave it empty and everything
//  still works locally and in production.
//
//  The userId is persisted in localStorage. The socket reads
//  it FRESH on every connect/reconnect via the `auth` callback,
//  so calling setUserId() before connecting works correctly.
// ============================================================

import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "../types";

// ============================================================
//  Backend URL resolution
// ============================================================

const PRODUCTION_BACKEND_URL =
    "https://youtube-watch-party-lmwi.onrender.com";

function resolveApiUrl(): string {
    // 1) Explicit env var (works in .env, Vercel, Netlify, Render)
    const explicit = import.meta.env.VITE_API_URL as string | undefined;
    if (explicit && explicit.trim().length > 0) {
        return stripTrailingSlash(explicit.trim());
    }

    // 2) Local development — detect localhost / LAN IPs
    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        const isLocal =
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "0.0.0.0" ||
            host.startsWith("192.168.") ||
            host.endsWith(".local");

        if (isLocal) {
            return "http://localhost:5000";
        }
    }

    // 3) Production fallback — the deployed Render backend
    return PRODUCTION_BACKEND_URL;
}

function stripTrailingSlash(url: string): string {
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const API_URL = resolveApiUrl();

// Helpful during development — remove or silence in production if noisy.
// eslint-disable-next-line no-console
console.log("[socket] backend URL:", API_URL);

// ============================================================
//  User identity
// ============================================================

const USER_ID_KEY = "watch-party:userId";

/** Reads (or creates) the persistent user ID for this browser. */
export function getOrCreateUserId(): string {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id || !/^user_[a-z0-9]{6,32}$/.test(id)) {
        const rand = Math.random().toString(36).slice(2, 12);
        id = `user_${rand}`;
        localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
}

// ============================================================
//  Socket instance
// ============================================================

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// NOTE: `auth` is a FUNCTION, not an object.
// Socket.IO calls it fresh on every connect/reconnect, so it always
// reads the latest userId from localStorage — no stale values.
export const socket: AppSocket = io(API_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: (cb) => {
        cb({ userId: getOrCreateUserId() });
    },
});

/**
 * Overwrites the persistent userId. If the socket is already
 * connected with the old id, it reconnects to apply the new one.
 */
export function setUserId(id: string): void {
    localStorage.setItem(USER_ID_KEY, id);

    // If we're already connected, force a reconnect so the handshake
    // sends the new userId.
    if (socket.connected) {
        socket.disconnect();
        socket.connect();
    }
}

/**
 * Returns the resolved backend URL. Useful for components that
 * need to make REST calls (e.g. Home.tsx's createRoom fetch).
 */
export function getBackendUrl(): string {
    return API_URL;
}