import { Role } from "../types";

export class PermissionService {
    canPlay(role: Role): boolean {
        return role === "host" || role === "moderator";
    }

    canPause(role: Role): boolean {
        return role === "host" || role === "moderator";
    }

    canSeek(role: Role): boolean {
        return role === "host" || role === "moderator";
    }

    canChangeVideo(role: Role): boolean {
        return role === "host" || role === "moderator";
    }

    canControlPlayback(role: Role): boolean {
        return role === "host" || role === "moderator";
    }

    canAssignRole(role: Role): boolean {
        return role === "host";
    }

    canRemoveParticipant(role: Role): boolean {
        return role === "host";
    }

    canTransferHost(role: Role): boolean {
        return role === "host";
    }

    isHost(role: Role): boolean {
        return role === "host";
    }
}

export const permissionService = new PermissionService();