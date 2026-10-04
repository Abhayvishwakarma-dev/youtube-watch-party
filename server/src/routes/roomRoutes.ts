// ============================================================
//  server/src/routes/roomRoutes.ts
//
//  REST endpoints for rooms.
//
//    POST /api/rooms          → create room (protected by JWT)
//    GET  /api/rooms/:roomId  → fetch room info (public)
//
//  The creator's userId comes from the JWT (authMiddleware),
//  so it matches the userId the socket uses after handshake.
//  This is what makes the room creator the host.
// ============================================================

import { Router, Request, Response } from "express";
import { roomService } from "../services/RoomService";
import { isValidRoomId } from "../utils/roomId";
import { authMiddleware, AuthedRequest } from "../middleware/authMiddleware";

const router = Router();

// ============================================================
//  POST /api/rooms
//  Headers: Authorization: Bearer <token>   (required)
//  Body:    { username?: string }           (optional, for display)
//  Returns: 201 { roomId, hostId }
// ============================================================
router.post(
    "/",
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
        const payload = req.user;
        if (!payload) {
            return res.status(401).json({
                error: "UNAUTHORIZED",
                message: "Not authenticated.",
            });
        }

        // ---------- Validate optional username ----------
        let displayName = payload.username;
        const incoming = (req.body ?? {}).username;
        if (typeof incoming === "string" && incoming.trim().length > 0) {
            displayName = incoming.trim().slice(0, 30);
        }

        // ---------- Create room with the VERIFIED user id ----------
        // This is the key: hostId = JWT userId, not a random one.
        const hostId = payload.userId;
        const room = roomService.createRoom(hostId);

        return res.status(201).json({
            roomId: room.roomId,
            hostId,
            username: displayName,
        });
    }
);

// ============================================================
//  GET /api/rooms/:roomId
//  Public — returns the current room state.
// ============================================================
router.get("/:roomId", (req: Request, res: Response) => {
    const { roomId } = req.params;

    if (!isValidRoomId(roomId)) {
        return res.status(400).json({ error: "Invalid room ID." });
    }

    const room = roomService.getRoom(roomId);
    if (!room) {
        return res.status(404).json({ error: "Room not found." });
    }

    return res.json(room.toState());
});

export default router;