const ROOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_ID_LENGTH = 6;

const USER_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const USER_ID_LENGTH = 10;

export function generateRoomId(): string {
    let id = "";
    for (let i = 0; i < ROOM_ID_LENGTH; i++) {
        id += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    return id;
}

export function generateUserId(): string {
    let id = "";
    for (let i = 0; i < USER_ID_LENGTH; i++) {
        id += USER_ALPHABET[Math.floor(Math.random() * USER_ALPHABET.length)];
    }
    return `user_${id}`;
}

export function isValidRoomId(roomId: string): boolean {
    return typeof roomId === "string" && /^[A-Z0-9]{6}$/.test(roomId);
}

export function isValidUserId(userId: string): boolean {
    return typeof userId === "string" && /^user_[a-z0-9]{6,20}$/.test(userId);
}