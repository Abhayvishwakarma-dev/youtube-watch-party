// ============================================================
//  server/src/utils/jwt.ts
//
//  JWT sign / verify helpers.
//
//  Used by:
//    - AuthService          → signToken() after register / login
//    - authMiddleware       → verifyToken() for protected REST routes
//    - socketHandler        → verifyToken() during WebSocket handshake
//
//  The secret is read from env.JWT_SECRET. Never hardcode it.
// ============================================================

import jwt from "jsonwebtoken";
import { env } from "../config/env";

// ---------- Types ----------
export interface JwtPayload {
    /** Stable user identifier — the MongoDB User._id as a string. */
    userId: string;
    /** Username at the time the token was issued. */
    username: string;
    /** Email at the time the token was issued. */
    email: string;
}

// The decoded token includes standard claims added by jsonwebtoken.
export interface DecodedJwt extends JwtPayload {
    iat: number; // issued at (unix seconds)
    exp: number; // expires at (unix seconds)
}

// ---------- Constants ----------
const TOKEN_EXPIRY = "7d"; // token valid for 7 days
const ISSUER = "watch-party";

// ---------- Sign ----------
/**
 * Signs a JWT with the given user payload.
 * Returns a signed token string.
 */
export function signToken(payload: JwtPayload): string {
    return jwt.sign(
        {
            userId: payload.userId,
            username: payload.username,
            email: payload.email,
        },
        env.JWT_SECRET,
        {
            expiresIn: TOKEN_EXPIRY,
            issuer: ISSUER,
        }
    );
}

// ---------- Verify ----------
/**
 * Verifies a JWT's signature and expiry.
 *
 * Returns the decoded payload if valid.
 * Returns null if the token is missing, malformed, expired, or
 * signed with a different secret.
 *
 * Never throws — always safe to call.
 */
export function verifyToken(token: string | undefined | null): DecodedJwt | null {
    if (!token || typeof token !== "string") return null;

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET, {
            issuer: ISSUER,
        });

        // jwt.verify returns string | JwtPayload — narrow to our shape.
        if (typeof decoded === "string") return null;

        const { userId, username, email, iat, exp } = decoded as any;

        // Sanity-check the shape.
        if (
            typeof userId !== "string" ||
            typeof username !== "string" ||
            typeof email !== "string"
        ) {
            return null;
        }

        return {
            userId,
            username,
            email,
            iat: typeof iat === "number" ? iat : 0,
            exp: typeof exp === "number" ? exp : 0,
        };
    } catch {
        // Invalid signature, expired, malformed — all flow through here.
        return null;
    }
}

// ---------- Decode without verifying (for debugging) ----------
/**
 * Decodes a JWT without verifying its signature.
 * Useful for logging / debugging — DO NOT use for auth decisions.
 */
export function decodeTokenUnsafe(token: string): DecodedJwt | null {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || typeof decoded === "string") return null;
        return decoded as DecodedJwt;
    } catch {
        return null;
    }
}

// ---------- Extract from Authorization header ----------
/**
 * Parses an `Authorization: Bearer <token>` header.
 * Returns the raw token, or null if the header is missing/invalid.
 */
export function extractBearerToken(
    header: string | undefined | null
): string | null {
    if (!header || typeof header !== "string") return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}