// ============================================================
//  server/src/server.ts
//
//  Express + Socket.IO server with optional MongoDB persistence
//  and JWT-based authentication.
// ============================================================

// ---------- Value imports ----------
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { env } from "./config/env";
import authRoutes from "./routes/authRoutes";
import roomRoutes from "./routes/roomRoutes";
import { setupSocketHandlers } from "./socket/socketHandler";
import { roomService } from "./services/RoomService";

// ---------- Type-only imports ----------
import type { Request, Response } from "express";
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    TypedServer,
} from "./socket/eventHandlers";
import type { SocketData } from "./types";

// ============================================================
//  CORS — single source of truth
//
//  Allowed origins are read from env.CLIENT_URL (comma-separated
//  for multiple origins). In development, localhost variants are
//  always allowed as well.
//
//  Set CLIENT_URL in .env like:
//     CLIENT_URL=http://localhost:5173
//     CLIENT_URL=https://your-app.vercel.app
//     CLIENT_URL=https://a.vercel.app,https://b.vercel.app
// ============================================================
function parseAllowedOrigins(): string[] {
    const raw = env.CLIENT_URL.split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    // In development, always allow localhost variants for convenience.
    if (env.NODE_ENV !== "production") {
        const devOrigins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ];
        for (const o of devOrigins) {
            if (!raw.includes(o)) raw.push(o);
        }
    }

    return raw;
}

const allowedOrigins = parseAllowedOrigins();

// eslint-disable-next-line no-console
console.log("[cors] allowed origins:", allowedOrigins);

// ============================================================
//  Express app
// ============================================================
const app = express();

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (curl, Postman, server-to-server).
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // eslint-disable-next-line no-console
            console.warn(`[cors] blocked origin: ${origin}`);
            return callback(
                new Error(`Origin ${origin} not allowed by CORS`),
                false
            );
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json({ limit: "100kb" }));

// ============================================================
//  Health check
// ============================================================
app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        env: env.NODE_ENV,
        db:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected",
        time: Date.now(),
    });
});

// ============================================================
//  REST routes
// ============================================================
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// ============================================================
//  404 fallback
// ============================================================
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
        origin: allowedOrigins,
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