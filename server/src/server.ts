// ============================================================
//  server/src/server.ts
//
//  Express + Socket.IO server with optional MongoDB persistence.
// ============================================================

import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { env } from "./config/env";
import roomRoutes from "./routes/roomRoutes";
import { setupSocketHandlers } from "./socket/socketHandler";
import { roomService } from "./services/RoomService";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    TypedServer,
} from "./socket/eventHandlers";
import { SocketData } from "./types";

// ============================================================
//  Express app
// ============================================================
const app = express();

app.use(
    cors({
        origin: env.CLIENT_URL,
        credentials: true,
    })
);
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        env: env.NODE_ENV,
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        time: Date.now(),
    });
});

app.use("/api/rooms", roomRoutes);

app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

// ============================================================
//  HTTP + Socket.IO server
// ============================================================
const server = http.createServer(app);

const io: TypedServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(server, {
    cors: {
        origin: env.CLIENT_URL,
        credentials: true,
        methods: ["GET", "POST"],
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
});

setupSocketHandlers(io);

// ============================================================
//  Startup — connect to MongoDB (if configured), then listen
// ============================================================
async function start(): Promise<void> {
    // Connect to MongoDB first (if configured)
    if (env.MONGODB_URI) {
        try {
            await mongoose.connect(env.MONGODB_URI);
            // eslint-disable-next-line no-console
            console.log("[db] MongoDB connected");

            // Rehydrate in-memory rooms from DB
            await roomService.loadRoomsFromDb();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[db] MongoDB connection failed:", err);
            // eslint-disable-next-line no-console
            console.warn("[db] Continuing in RAM-only mode");
        }
    } else {
        // eslint-disable-next-line no-console
        console.log("[db] MONGODB_URI not set — running in RAM-only mode");
    }

    server.listen(env.PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`[server] listening on port ${env.PORT}`);
        // eslint-disable-next-line no-console
        console.log(`[server] CLIENT_URL = ${env.CLIENT_URL}`);
        // eslint-disable-next-line no-console
        console.log(`[server] NODE_ENV   = ${env.NODE_ENV}`);
    });
}

void start();

// ============================================================
//  Graceful shutdown
// ============================================================
function shutdown(signal: string): void {
    // eslint-disable-next-line no-console
    console.log(`\n[server] received ${signal}, shutting down...`);
    io.close(() => {
        server.close(async () => {
            try {
                await mongoose.disconnect();
            } catch {
                /* ignore */
            }
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));