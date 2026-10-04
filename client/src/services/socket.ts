// ============================================================
//  client/src/services/socket.ts
//
//  Single, shared Socket.IO connection.
//
//  Handshake auth: sends the JWT from localStorage. The backend
//  verifies it and derives the user's identity from the token,
//  which is what makes the room creator the host.
//
//  Backend URL resolution:
//    1. import.meta.env.VITE_API_URL    (if set in .env or Vercel)
//    2. http://localhost:5000           (when running locally)
//    3. Render fallback URL             (production default)
//
//  So VITE_API_URL is OPTIONAL. Leave it empty and everything
//  still works locally and in production.
// ============================================================

import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "../types";
import { getToken } from "../utils/storage";

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

// eslint-disable-next-line no-console
console.log("[socket] backend URL:", API_URL);

// ============================================================
//  Socket instance
// ============================================================

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// NOTE: `auth` is a FUNCTION, not an object.
// Socket.IO calls it fresh on every connect/reconnect, so it always
// reads the LATEST token from localStorage — no stale values.
export const socket: AppSocket = io(API_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: (cb) => {
        const token = getToken();
        // eslint-disable-next-line no-console
        console.log("[socket] handshake auth:", {
            hasToken: !!token,
            tokenPreview: token ? token.slice(0, 20) + "…" : null,
        });
        cb({ token: token ?? undefined });
    },
});

/**
 * Force a reconnect so the next handshake picks up the latest
 * auth token. Call this after login / logout / token refresh.
 */
export function reconnectSocket(): void {
    if (socket.connected) {
        socket.disconnect();
    }
    socket.connect();
}

/**
 * Returns the resolved backend URL. Useful for components that
 * need to make REST calls (e.g. Home.tsx's createRoom fetch).
 */
export function getBackendUrl(): string {
    return API_URL;
}