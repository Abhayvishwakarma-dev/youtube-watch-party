// ============================================================
//  client/src/utils/storage.ts
//
//  Safe wrappers around localStorage for auth persistence.
//
//  What we persist:
//    - "watch-party:token"  → JWT issued by the backend
//    - "watch-party:user"   → { userId, username, email }
//
//  Why a wrapper:
//    - localStorage throws in private browsing / disabled cookies
//      → we catch and degrade gracefully (auth just won't persist)
//    - JSON parsing can fail if data is corrupted
//      → we validate shape before returning
//    - Single place to change the storage keys
// ============================================================

import type { User } from "../types/auth";

// ============================================================
//  Storage keys
// ============================================================
const TOKEN_KEY = "watch-party:token";
const USER_KEY = "watch-party:user";

// ============================================================
//  Low-level safe access
// ============================================================

function safeGet(key: string): string | null {
    try {
        if (typeof window === "undefined") return null;
        return window.localStorage.getItem(key);
    } catch {
        // localStorage may be disabled (private mode, quota, etc.)
        return null;
    }
}

function safeSet(key: string, value: string): void {
    try {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(key, value);
    } catch {
        /* silently ignore — persistence is a nice-to-have */
    }
}

function safeRemove(key: string): void {
    try {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem(key);
    } catch {
        /* silently ignore */
    }
}

// ============================================================
//  Token
// ============================================================

export function getToken(): string | null {
    const raw = safeGet(TOKEN_KEY);
    if (!raw) return null;
    // Basic sanity: JWT has 3 dot-separated segments.
    if (raw.split(".").length !== 3) {
        // Corrupted or old format — clear it.
        safeRemove(TOKEN_KEY);
        return null;
    }
    return raw;
}

export function setToken(token: string): void {
    if (!token || typeof token !== "string") return;
    safeSet(TOKEN_KEY, token);
}

export function clearToken(): void {
    safeRemove(TOKEN_KEY);
}

// ============================================================
//  User
// ============================================================

/** Validates that an unknown value looks like our `User` shape. */
function isUser(value: unknown): value is User {
    if (!value || typeof value !== "object") return false;
    const u = value as Record<string, unknown>;
    return (
        typeof u.userId === "string" &&
        typeof u.username === "string" &&
        typeof u.email === "string"
    );
}

export function getUser(): User | null {
    const raw = safeGet(USER_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!isUser(parsed)) {
            // Corrupted or old format — clear it.
            safeRemove(USER_KEY);
            return null;
        }
        return parsed;
    } catch {
        // Malformed JSON — clear it.
        safeRemove(USER_KEY);
        return null;
    }
}

export function setUser(user: User): void {
    if (!isUser(user)) return;
    try {
        safeSet(USER_KEY, JSON.stringify(user));
    } catch {
        /* ignore */
    }
}

export function clearUser(): void {
    safeRemove(USER_KEY);
}

// ============================================================
//  Auth bundle helpers
// ============================================================

/**
 * Persists both the token and the user together.
 * Call this after a successful register / login.
 */
export function saveAuth(token: string, user: User): void {
    setToken(token);
    setUser(user);
}

/**
 * Removes both the token and the user.
 * Call this on logout or when the server rejects the token.
 */
export function clearAuth(): void {
    clearToken();
    clearUser();
}

/**
 * Convenience: returns true if we have both a token and a user.
 * Note: this does NOT validate the token with the server.
 * Use useAuth().refresh() for that.
 */
export function hasStoredAuth(): boolean {
    return !!getToken() && !!getUser();
}