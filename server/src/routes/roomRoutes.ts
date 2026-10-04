import { Router, Request, Response } from "express";
import { roomService } from "../services/RoomService";
import { generateUserId, isValidRoomId } from "../utils/roomId";

const router = Router();

/**
 * POST /api/rooms
 * Body: { username: string }
 * Creates a new room. The caller becomes the host.
 * Returns: { roomId, hostId }
 */
router.post("/", (req: Request, res: Response) => {
    const { username } = req.body ?? {};

    if (
        !username ||
        typeof username !== "string" ||
        username.trim().length === 0 ||
        username.trim().length > 30
    ) {
        return res
            .status(400)
            .json({ error: "Username must be 1–30 characters." });
    }

    const hostId = generateUserId();
    const room = roomService.createRoom(hostId);

    return res.status(201).json({
        roomId: room.roomId,
        hostId,
    });
});

/**
 * GET /api/rooms/:roomId
 * Returns current room info (safe to expose).
 */
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