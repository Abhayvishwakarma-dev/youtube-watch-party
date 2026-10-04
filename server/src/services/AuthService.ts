// ============================================================
//  server/src/services/AuthService.ts
//
//  Business logic for authentication.
//
//  Responsibilities:
//    - register()  → validate inputs, ensure uniqueness, create user, sign JWT
//    - login()     → verify credentials, sign JWT
//    - getMe()     → fetch current user from a verified JWT payload
//
//  Password hashing happens AUTOMATICALLY in User.ts's pre-save hook.
//  JWT signing uses the helpers from utils/jwt.ts.
//
//  Errors are thrown as `AuthError` with a machine-readable code
//  and a human-readable message. Routes translate them into
//  HTTP status codes; socket handlers can reuse them too.
// ============================================================

import { User, PublicUser, validateUsername, validateEmail, validatePassword } from "../models/User";
import { signToken, JwtPayload } from "../utils/jwt";

// ============================================================
//  Error type
// ============================================================

export type AuthErrorCode =
    | "INVALID_USERNAME"
    | "INVALID_EMAIL"
    | "INVALID_PASSWORD"
    | "INVALID_CREDENTIALS"
    | "USERNAME_TAKEN"
    | "EMAIL_TAKEN"
    | "USER_NOT_FOUND"
    | "DB_ERROR";

export class AuthError extends Error {
    constructor(
        public code: AuthErrorCode,
        message: string,
        public statusCode: number = 400
    ) {
        super(message);
        this.name = "AuthError";
    }
}

// ============================================================
//  Result types
// ============================================================

export interface AuthResult {
    user: PublicUser;
    token: string;
}

// ============================================================
//  AuthService
// ============================================================

export class AuthService {
    // --------------------------------------------------------
    //  Register
    // --------------------------------------------------------
    /**
     * Create a new user account.
     *
     * Steps:
     *   1. Validate username, email, password
     *   2. Check that username and email are not already taken
     *   3. Create the user (User.ts pre-save hook hashes the password)
     *   4. Sign a JWT for immediate login
     *
     * Throws AuthError on any failure.
     */
    static async register(input: {
        username: unknown;
        email: unknown;
        password: unknown;
    }): Promise<AuthResult> {
        // ---------- 1. Validate ----------
        const username = validateUsername(input.username);
        if (!username) {
            throw new AuthError(
                "INVALID_USERNAME",
                "Username must be 2–30 characters and contain only letters, numbers, spaces, underscores, or hyphens.",
                400
            );
        }

        const email = validateEmail(input.email);
        if (!email) {
            throw new AuthError(
                "INVALID_EMAIL",
                "Please enter a valid email address.",
                400
            );
        }

        const password = validatePassword(input.password);
        if (!password) {
            throw new AuthError(
                "INVALID_PASSWORD",
                "Password must be at least 6 characters long.",
                400
            );
        }

        // ---------- 2. Check uniqueness ----------
        try {
            if (await User.usernameExists(username)) {
                throw new AuthError(
                    "USERNAME_TAKEN",
                    "That username is already taken.",
                    409
                );
            }
            if (await User.emailExists(email)) {
                throw new AuthError(
                    "EMAIL_TAKEN",
                    "That email is already registered.",
                    409
                );
            }
        } catch (err) {
            if (err instanceof AuthError) throw err;
            // eslint-disable-next-line no-console
            console.error("[auth] uniqueness check failed:", err);
            throw new AuthError(
                "DB_ERROR",
                "Could not create account. Please try again.",
                500
            );
        }

        // ---------- 3. Create the user ----------
        let user;
        try {
            user = new User({
                username,
                email,
                passwordHash: password, // pre-save hook will hash this
            });
            await user.save();
        } catch (err: any) {
            // Handle MongoDB duplicate key error (E11000) — race condition
            // where two requests passed the uniqueness check simultaneously.
            if (err?.code === 11000) {
                const field = Object.keys(err.keyPattern ?? {})[0];
                if (field === "email") {
                    throw new AuthError(
                        "EMAIL_TAKEN",
                        "That email is already registered.",
                        409
                    );
                }
                throw new AuthError(
                    "USERNAME_TAKEN",
                    "That username is already taken.",
                    409
                );
            }
            // eslint-disable-next-line no-console
            console.error("[auth] register save failed:", err);
            throw new AuthError(
                "DB_ERROR",
                "Could not create account. Please try again.",
                500
            );
        }

        // ---------- 4. Sign JWT ----------
        const token = signToken({
            userId: user._id.toString(),
            username: user.username,
            email: user.email,
        });

        return {
            user: user.toPublic(),
            token,
        };
    }

    // --------------------------------------------------------
    //  Login
    // --------------------------------------------------------
    /**
     * Authenticate an existing user.
     *
     * `identifier` may be either an email address or a username.
     * `password` is the plaintext password to verify.
     *
     * NOTE: For security we deliberately do NOT distinguish between
     * "user not found" and "wrong password" — both return the same
     * INVALID_CREDENTIALS error to prevent account enumeration.
     */
    static async login(input: {
        identifier: unknown;
        password: unknown;
    }): Promise<AuthResult> {
        const identifier =
            typeof input.identifier === "string" ? input.identifier.trim() : "";
        const password =
            typeof input.password === "string" ? input.password : "";

        if (!identifier || !password) {
            throw new AuthError(
                "INVALID_CREDENTIALS",
                "Invalid email/username or password.",
                401
            );
        }

        // ---------- 1. Find user ----------
        let user;
        try {
            user = await User.findByEmailOrUsername(identifier);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[auth] login lookup failed:", err);
            throw new AuthError(
                "DB_ERROR",
                "Login failed. Please try again.",
                500
            );
        }

        if (!user) {
            // Same error as wrong password — see note above.
            throw new AuthError(
                "INVALID_CREDENTIALS",
                "Invalid email/username or password.",
                401
            );
        }

        // ---------- 2. Verify password ----------
        const ok = await user.comparePassword(password);
        if (!ok) {
            throw new AuthError(
                "INVALID_CREDENTIALS",
                "Invalid email/username or password.",
                401
            );
        }

        // ---------- 3. Sign JWT ----------
        const token = signToken({
            userId: user._id.toString(),
            username: user.username,
            email: user.email,
        });

        return {
            user: user.toPublic(),
            token,
        };
    }

    // --------------------------------------------------------
    //  getMe
    // --------------------------------------------------------
    /**
     * Load the current user from a verified JWT payload.
     * The payload has already been validated by authMiddleware or
     * the socket handshake, so we only need to re-fetch the
     * freshest user data from the DB.
     *
     * Returns null if the user no longer exists (e.g. deleted
     * after the token was issued). The caller should treat this
     * as "token belongs to a now-invalid account".
     */
    static async getMe(payload: JwtPayload): Promise<PublicUser | null> {
        try {
            const user = await User.findByUserId(payload.userId);
            if (!user) return null;
            return user.toPublic();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[auth] getMe failed:", err);
            return null;
        }
    }

    // --------------------------------------------------------
    //  Convenience: is this username/email available?
    // --------------------------------------------------------
    /**
     * Used by the frontend for live "username available" feedback
     * during signup (optional — not required by the MVP).
     */
    static async checkAvailability(input: {
        username?: unknown;
        email?: unknown;
    }): Promise<{ usernameAvailable?: boolean; emailAvailable?: boolean }> {
        const result: { usernameAvailable?: boolean; emailAvailable?: boolean } = {};

        const username = validateUsername(input.username);
        if (username) {
            try {
                result.usernameAvailable = !(await User.usernameExists(username));
            } catch {
                result.usernameAvailable = undefined;
            }
        }

        const email = validateEmail(input.email);
        if (email) {
            try {
                result.emailAvailable = !(await User.emailExists(email));
            } catch {
                result.emailAvailable = undefined;
            }
        }

        return result;
    }
}

export const authService = AuthService;