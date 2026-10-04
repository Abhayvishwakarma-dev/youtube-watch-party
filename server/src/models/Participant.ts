import { PublicParticipant, Role } from "../types";

export class Participant {
    constructor(
        public userId: string,
        public username: string,
        public role: Role,
        public socketId: string
    ) {}

    /** Public, safe-to-broadcast representation. */
    toPublic(): PublicParticipant {
        return {
            userId: this.userId,
            username: this.username,
            role: this.role,
        };
    }

    toJSON(): PublicParticipant {
        return this.toPublic();
    }
}