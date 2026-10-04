// ============================================================
//  server/src/config/env.ts
//
//  Environment variable loader + validation.
//
//  Any variable that MUST be present throws on startup if
//  missing — fail fast instead of discovering it at runtime.
//
//  Variables that have safe defaults (like PORT, NODE_ENV)
//  fall back gracefully.
// ============================================================

import dotenv from "dotenv";

dotenv.config();

// ============================================================
//  Helpers
// ============================================================

function required(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (value === undefined || value === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optional(name: string, fallback = ""): string {
    const value = process.env[name];
    if (value === undefined || value === "") return fallback;
    return value;
}

// ============================================================
//  Exported env
// ============================================================

export const env = {
    // ---------- Server ----------
    PORT: parseInt(process.env.PORT ?? "5000", 10),
    NODE_ENV: process.env.NODE_ENV ?? "development",

    // ---------- CORS ----------
    /** Frontend origin — used for CORS allow-list. */
    CLIENT_URL: required("CLIENT_URL", "http://localhost:5173"),

    // ---------- Database ----------
    /** MongoDB connection string. Empty = RAM-only mode. */
    MONGODB_URI: optional("MONGODB_URI", ""),

    // ---------- Auth ----------
    /**
     * Secret used to sign and verify JWTs.
     * Required — server refuses to start without it in production.
     * In development, falls back to a safe default so `npm run dev`
     * works out of the box.
     */
    JWT_SECRET: required(
        "JWT_SECRET",
        "dev-only-secret-do-not-use-in-production-please-change-me"
    ),
} as const;

// ============================================================
//  Startup safety checks
// ============================================================

// In production, refuse to run with the default JWT secret.
if (
    env.NODE_ENV === "production" &&
    env.JWT_SECRET.startsWith("dev-only-secret")
) {
    // eslint-disable-next-line no-console
    console.error(
        "\n[env] FATAL: JWT_SECRET is still set to the development default in production.\n" +
            "       Generate a strong random value and set it in your environment:\n" +
            '       node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n'
    );
    process.exit(1);
}

// Warn if JWT_SECRET is too short.
if (env.JWT_SECRET.length < 32) {
    // eslint-disable-next-line no-console
    console.warn(
        "[env] WARNING: JWT_SECRET is shorter than 32 characters. " +
            "Use a longer random value in production."
    );
}