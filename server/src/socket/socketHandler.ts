// ============================================================
//  server/src/socket/socketHandler.ts
//
//  Socket.IO handshake middleware + connection handler.
//
//  Auth resolution order:
//    1. JWT token (auth.token)     → verify → socket.data from payload
//    2. Legacy userId (auth.userId) → dev migration fallback
//    3. Dev-only                  → throwaway id
// ============================================================

import { registerEventHandlers } from "./eventHandlers";
import { verifyToken } from "../utils/jwt";
import { generateUserId } from "../utils/roomId";
import type { TypedServer, TypedSocket } from "./eventHandlers";
import type { SocketAuth, SocketData } from "../types";

export function setupSocketHandlers(io: TypedServer): void {
    // ---------------------------------------------------------
    //  Handshake middleware
    // ---------------------------------------------------------
    io.use((socket, next) => {
        const auth = (socket.handshake.auth ?? {}) as SocketAuth;
        const sData = socket.data as SocketData;

        // ---------- 1. Preferred: JWT token ----------
        if (typeof auth.token === "string" && auth.token.length > 0) {
            const payload = verifyToken(auth.token);

            if (!payload) {
                return next(
                    new Error("Unauthorized: invalid or expired token")
                );
            }

            sData.userId = payload.userId;
            sData.username = payload.username;
            sData.email = payload.email;
            sData.roomId = undefined;

            // eslint-disable-next-line no-console
            console.log(
                `[socket] handshake OK (JWT) user=${payload.userId} (${payload.username})`
            );
            return next();
        }

        // ---------- 2. Legacy fallback: raw userId ----------
        if (typeof auth.userId === "string" && auth.userId.length > 0) {
            if (!/^user_[a-z0-9]{6,32}$/.test(auth.userId)) {
                return next(new Error("Unauthorized: bad legacy userId"));
            }

            sData.userId = auth.userId;
            sData.username = undefined;
            sData.email = undefined;
            sData.roomId = undefined;

            // eslint-disable-next-line no-console
            console.warn(
                `[socket] handshake OK (LEGACY userId) user=${auth.userId}`
            );
            return next();
        }

        // ---------- 3. Dev fallback ----------
        if (process.env.NODE_ENV !== "production") {
            const temp = generateUserId();
            sData.userId = temp;
            sData.roomId = undefined;
            // eslint-disable-next-line no-console
            console.warn(`[socket] handshake OK (DEV fallback) user=${temp}`);
            return next();
        }

        // eslint-disable-next-line no-console
        console.warn("[socket] handshake REJECTED — no auth token");
        return next(new Error("Unauthorized"));
    });

    // ---------------------------------------------------------
    //  Connection handler
    // ---------------------------------------------------------
    io.on("connection", (socket: TypedSocket) => {
        const sData = socket.data as SocketData;
        // eslint-disable-next-line no-console
        console.log(
            `[socket] connect ${socket.id} user=${sData.userId} (${
                sData.username ?? "no-username"
            })`
        );

        registerEventHandlers(io, socket);
    });
}