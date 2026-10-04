// ============================================================
//  server/src/socket/socketHandler.ts
//
//  Attaches Socket.IO lifecycle handling:
//    1. Handshake middleware — assign a persistent userId
//       to every connecting socket (from auth.userId if present,
//       otherwise a freshly generated one).
//    2. On each connection, delegate the event wiring to
//       registerEventHandlers(io, socket).
//
//  Strongly typed via the event maps declared in eventHandlers.ts
//  so that event names and payloads are checked at compile time.
// ============================================================

import { generateUserId } from "../utils/roomId";
import {
    registerEventHandlers,
    TypedServer,
    TypedSocket,
} from "./eventHandlers";

// ============================================================
//  setupSocketHandlers
// ============================================================
export function setupSocketHandlers(io: TypedServer): void {
    // ---------------------------------------------------------
    //  Handshake middleware
    //  Runs once per socket, before the "connection" event fires.
    //  The client may supply a userId via `auth.userId`
    //  (persisted in localStorage on the frontend).
    // ---------------------------------------------------------
    io.use((socket, next) => {
        const auth = (socket.handshake.auth ?? {}) as { userId?: string };
        const incoming = auth.userId;

        let userId: string;
        if (
            typeof incoming === "string" &&
            /^user_[a-z0-9]{6,32}$/.test(incoming)
        ) {
            userId = incoming;
        } else {
            userId = generateUserId();
        }

        socket.data.userId = userId;
        socket.data.roomId = undefined;

        next();
    });

    // ---------------------------------------------------------
    //  Connection handler
    //  Fires after the middleware calls next() successfully.
    // ---------------------------------------------------------
    io.on("connection", (socket: TypedSocket) => {
        // eslint-disable-next-line no-console
        console.log(
            `[socket] connect ${socket.id} (user=${socket.data.userId})`
        );

        // Wire all client→server events (join_room, play, pause, ...)
        registerEventHandlers(io, socket);
    });
}