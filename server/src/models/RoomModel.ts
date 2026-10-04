// ============================================================
//  server/src/models/RoomModel.ts
//
//  Mongoose schema for persisting room metadata.
//  Only room identity + last known playback state are stored.
//  Chat, reactions, socket IDs stay in RAM.
// ============================================================

import mongoose, { Document, Schema } from "mongoose";

export interface RoomDoc extends Document {
    roomId: string;
    hostId: string;
    videoId: string | null;
    currentTime: number;
    playState: "playing" | "paused";
    createdAt: Date;
    updatedAt: Date;
}

const RoomSchema: Schema = new Schema(
    {
        roomId: { type: String, required: true, unique: true, index: true },
        hostId: { type: String, required: true },
        videoId: { type: String, default: null },
        currentTime: { type: Number, default: 0 },
        playState: {
            type: String,
            enum: ["playing", "paused"],
            default: "paused",
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { collection: "rooms" }
);

export const RoomModel = mongoose.model<RoomDoc>("Room", RoomSchema);