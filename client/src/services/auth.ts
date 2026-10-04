// ============================================================
//  client/src/services/auth.ts
//
//  API client for the backend's auth routes.
//
//  Endpoints (must match server/src/routes/authRoutes.ts):
//    POST /api/auth/register  → { user, token }
//    POST /api/auth/login     → { user, token }
//    GET  /api/auth/me        → { user }   (requires Bearer)
//    GET  /api/auth/availability?username=...&email=...
//
//  Error mapping:
//    - HTTP error responses → AuthClientError with the server's code
//    - Network failures     → AuthClientError with code "NETWORK_ERROR"
//    - JSON parse failures  → AuthClientError with code "UNKNOWN"
//
//  All functions return parsed, typed data or throw AuthClientError.
//  Callers (useAuth hook) catch and translate to UI state.
// ============================================================

import type {
    AuthErrorBody,
    AuthErrorCode,
    AuthResponse,
    AvailabilityResponse,
    LoginPayload,
    MeResponse,
    RegisterPayload,
    User,
} from "../types/auth";
import { AuthClientError } from "../types/auth";
import { getBackendUrl } from "./socket";
import { getToken, saveAuth, clearAuth } from "../utils/storage";

// ============================================================
//  Internal helpers
// ============================================================

/**
 * Performs a fetch, parses the JSON body, and throws a
 * normalized `AuthClientError` on any failure.
 */
async function requestJson<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${getBackendUrl()}${path}`;

    let res: Response;
    try {
        res = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers ?? {}),
            },
        });
    } catch (err) {
        // Network error — server down, DNS failure, offline, etc.
        throw new AuthClientError(
            "NETWORK_ERROR",
            "Cannot reach the server. Please check your connection.",
            undefined
        );
    }

    // Try to parse JSON body (some errors don't return JSON).
    let body: unknown = null;
    const text = await res.text();
    if (text && text.length > 0) {
        try {
            body = JSON.parse(text);
        } catch {
            // Non-JSON response (e.g. proxy error page).
            if (!res.ok) {
                throw new AuthClientError(
                    "UNKNOWN",
                    `Server error (${res.status}). Please try again.`,
                    res.status
                );
            }
            throw new AuthClientError(
                "UNKNOWN",
                "Invalid response from server.",
                res.status
            );
        }
    }

    // Success path.
    if (res.ok) {
        return body as T;
    }

    // Error path — normalize the code and message.
    const err = body as Partial<AuthErrorBody> | null;
    const code: AuthErrorCode = isAuthErrorCode(err?.error)
        ? (err!.error as AuthErrorCode)
        : "UNKNOWN";
    const message =
        typeof err?.message === "string" && err.message.trim().length > 0
            ? err.message
            : `Request failed (${res.status}).`;

    throw new AuthClientError(code, message, res.status);
}

/** Type guard for the error code union. */
function isAuthErrorCode(value: unknown): value is AuthErrorCode {
    if (typeof value !== "string") return false;
    const known: AuthErrorCode[] = [
        "INVALID_USERNAME",
        "INVALID_EMAIL",
        "INVALID_PASSWORD",
        "INVALID_CREDENTIALS",
        "USERNAME_TAKEN",
        "EMAIL_TAKEN",
        "USER_NOT_FOUND",
        "UNAUTHORIZED",
        "DB_ERROR",
        "INTERNAL",
        "NETWORK_ERROR",
        "UNKNOWN",
    ];
    return known.includes(value as AuthErrorCode);
}

/** Builds a `Bearer <token>` Authorization header from storage. */
function authHeader(): Record<string, string> {
    const token = getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

// ============================================================
//  Public API
// ============================================================

/**
 * Register a new account.
 * On success, persists the token and user to localStorage.
 */
export async function register(payload: RegisterPayload): Promise<User> {
    const data = await requestJson<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    saveAuth(data.token, data.user);
    return data.user;
}

/**
 * Log in with email-or-username and password.
 * On success, persists the token and user to localStorage.
 */
export async function login(payload: LoginPayload): Promise<User> {
    const data = await requestJson<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    saveAuth(data.token, data.user);
    return data.user;
}

/**
 * Fetch the current user from the server using the stored JWT.
 * If the token is missing, invalid, or expired, clears local state
 * and returns null.
 */
export async function getMe(): Promise<User | null> {
    if (!getToken()) {
        // No token at all — nothing to verify.
        clearAuth();
        return null;
    }

    try {
        const data = await requestJson<MeResponse>("/api/auth/me", {
            method: "GET",
            headers: authHeader(),
        });
        return data.user;
    } catch (err) {
        if (err instanceof AuthClientError) {
            // Server rejected the token (expired / invalid / user gone).
            if (
                err.code === "UNAUTHORIZED" ||
                err.code === "USER_NOT_FOUND"
            ) {
                clearAuth();
                return null;
            }
            // Network errors should NOT log the user out — they might
            // just be offline. Rethrow so the caller can decide.
            if (err.code === "NETWORK_ERROR") {
                throw err;
            }
        }
        // Anything else — treat as unauthenticated.
        clearAuth();
        return null;
    }
}

/**
 * Optional: check whether a username and/or email are available.
 * Used for live feedback on the signup form.
 */
export async function checkAvailability(params: {
    username?: string;
    email?: string;
}): Promise<AvailabilityResponse> {
    const qs = new URLSearchParams();
    if (params.username?.trim()) qs.set("username", params.username.trim());
    if (params.email?.trim()) qs.set("email", params.email.trim());

    if (qs.toString().length === 0) return {};

    return requestJson<AvailabilityResponse>(
        `/api/auth/availability?${qs.toString()}`,
        { method: "GET" }
    );
}

/**
 * Convenience: clear any persisted auth state.
 * Callers usually do this from useAuth().logout().
 */
export function clearLocalAuth(): void {
    clearAuth();
}

// ============================================================
//  Named export object (optional — for `auth.login()` style)
// ============================================================

export const authApi = {
    register,
    login,
    getMe,
    checkAvailability,
    clearLocalAuth,
};