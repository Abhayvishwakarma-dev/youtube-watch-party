// ============================================================
//  client/src/services/socket.ts
//
//  Single, shared Socket.IO connection.
//
//  The userId is persisted in localStorage. The socket reads
//  it FRESH on every connect/reconnect via the `auth` callback,
//  so calling setUserId() before connecting works correctly.
// ============================================================

import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

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