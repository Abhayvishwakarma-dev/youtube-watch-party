// ============================================================
//  client/src/types/auth.ts
//
//  Auth-related types. Mirrors the backend's response shapes
//  from server/src/services/AuthService.ts and the error
//  codes thrown by AuthError.
//
//  Kept in a separate file from types/index.ts so the auth
//  surface is easy to see at a glance.
// ============================================================

// ============================================================
//  Core entities
// ============================================================

/** Public user shape returned by the backend. */
export interface User {
    userId: string;
    username: string;
    email: string;
}

/** Payload accepted by POST /api/auth/register. */
export interface RegisterPayload {
    username: string;
    email: string;
    password: string;
}

/**
 * Payload accepted by POST /api/auth/login.
 * `identifier` may be either an email address or a username.
 */
export interface LoginPayload {
    identifier: string;
    password: string;
}

/** Success response from register and login. */
export interface AuthResponse {
    user: User;
    token: string;
}

/** Success response from GET /api/auth/me. */
export interface MeResponse {
    user: User;
}

/** Query result from GET /api/auth/availability. */
export interface AvailabilityResponse {
    usernameAvailable?: boolean;
    emailAvailable?: boolean;
}

// ============================================================
//  Errors
// ============================================================

/**
 * Auth error codes returned by the backend. Must stay in sync
 * with `AuthErrorCode` in server/src/types/index.ts.
 */
export type AuthErrorCode =
    | "INVALID_USERNAME"
    | "INVALID_EMAIL"
    | "INVALID_PASSWORD"
    | "INVALID_CREDENTIALS"
    | "USERNAME_TAKEN"
    | "EMAIL_TAKEN"
    | "USER_NOT_FOUND"
    | "UNAUTHORIZED"
    | "DB_ERROR"
    | "INTERNAL"
    | "NETWORK_ERROR"
    | "UNKNOWN";

/** Shape of the JSON body the backend returns on error. */
export interface AuthErrorBody {
    error: AuthErrorCode;
    message: string;
}

/**
 * Normalised error class thrown by the auth service layer.
 * Wraps both HTTP error responses and network failures so callers
 * always deal with the same shape.
 */
export class AuthClientError extends Error {
    constructor(
        public code: AuthErrorCode,
        message: string,
        public status?: number
    ) {
        super(message);
        this.name = "AuthClientError";
    }
}

// ============================================================
//  Local auth state (kept in useAuth hook)
// ============================================================

/** State exposed by useAuth(). */
export interface AuthState {
    user: User | null;
    token: string | null;
    loading: boolean;
    initialized: boolean;
    error: string | null;
}

/** Actions exposed by useAuth(). */
export interface AuthActions {
    register: (payload: RegisterPayload) => Promise<User>;
    login: (payload: LoginPayload) => Promise<User>;
    logout: () => void;
    refresh: () => Promise<User | null>;
    clearError: () => void;
}

/** Combined shape returned by useAuth(). */
export type UseAuthResult = AuthState & AuthActions;

// ============================================================
//  Validation helpers (client-side, mirrors backend rules)
// ============================================================
//
// These match the constants in server/src/models/User.ts.
// Keep them in sync — the backend is authoritative, but doing
// a quick client-side check gives better UX (instant feedback).

export const AUTH_LIMITS = {
    MIN_USERNAME_LENGTH: 2,
    MAX_USERNAME_LENGTH: 30,
    MIN_PASSWORD_LENGTH: 6,
    MAX_PASSWORD_LENGTH: 128,
} as const;

const USERNAME_REGEX = /^[a-zA-Z0-9_ -]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns null if valid, error message otherwise. */
export function validateUsername(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length < AUTH_LIMITS.MIN_USERNAME_LENGTH) {
        return `Username must be at least ${AUTH_LIMITS.MIN_USERNAME_LENGTH} characters.`;
    }
    if (trimmed.length > AUTH_LIMITS.MAX_USERNAME_LENGTH) {
        return `Username must be ${AUTH_LIMITS.MAX_USERNAME_LENGTH} characters or fewer.`;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
        return "Username can only contain letters, numbers, spaces, underscores, and hyphens.";
    }
    return null;
}

/** Returns null if valid, error message otherwise. */
export function validateEmail(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return "Email is required.";
    if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address.";
    if (trimmed.length > 254) return "Email is too long.";
    return null;
}

/** Returns null if valid, error message otherwise. */
export function validatePassword(raw: string): string | null {
    if (raw.length < AUTH_LIMITS.MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${AUTH_LIMITS.MIN_PASSWORD_LENGTH} characters.`;
    }
    if (raw.length > AUTH_LIMITS.MAX_PASSWORD_LENGTH) {
        return `Password must be ${AUTH_LIMITS.MAX_PASSWORD_LENGTH} characters or fewer.`;
    }
    return null;
}