// ============================================================
//  server/src/middleware/authMiddleware.ts
//
//  Express middleware for JWT-protected routes.
//
//  Usage:
//    import { authMiddleware, AuthedRequest } from "../middleware/authMiddleware";
//
//    router.get("/me", authMiddleware, (req: AuthedRequest, res) => {
//        const payload = req.user; // guaranteed non-null past middleware
//        // ...
//    });
//
//  Behavior:
//    - Reads `Authorization: Bearer <token>` header
//    - Verifies token via utils/jwt.ts → verifyToken()
//    - On success: attaches decoded payload to `req.user`, calls next()
//    - On failure: responds 401 immediately, does NOT call next()
//
//  Never throws. Always responds or delegates.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { verifyToken, DecodedJwt, extractBearerToken } from "../utils/jwt";

// ============================================================
//  Extended request type
// ============================================================

/**
 * Express `Request` augmented with a verified `user` payload.
 * Only present after `authMiddleware` runs successfully.
 */
export interface AuthedRequest extends Request {
    user?: DecodedJwt;
}

// ============================================================
//  Middleware
// ============================================================

/**
 * Verifies the request's JWT and attaches the decoded payload
 * to `req.user`. Rejects with 401 if the token is missing,
 * malformed, expired, or signed with a different secret.
 */
export function authMiddleware(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
): void {
    // ---------- 1. Extract token from Authorization header ----------
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
        res.status(401).json({
            error: "UNAUTHORIZED",
            message: "Missing or invalid authorization header.",
        });
        return;
    }

    // ---------- 2. Verify signature and expiry ----------
    const payload = verifyToken(token);

    if (!payload) {
        res.status(401).json({
            error: "UNAUTHORIZED",
            message: "Invalid or expired token.",
        });
        return;
    }

    // ---------- 3. Attach payload to request ----------
    req.user = payload;

    // ---------- 4. Delegate to next handler ----------
    next();
}

// ============================================================
//  Optional middleware — soft auth
// ============================================================
/**
 * Like authMiddleware, but does NOT reject unauthenticated requests.
 * If a valid token is present it attaches `req.user`; otherwise
 * it simply calls next() with `req.user` undefined.
 *
 * Useful for endpoints that behave differently for logged-in users
 * but remain accessible to everyone (e.g. public room listings).
 */
export function optionalAuthMiddleware(
    req: AuthedRequest,
    _res: Response,
    next: NextFunction
): void {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
        const payload = verifyToken(token);
        if (payload) {
            req.user = payload;
        }
    }
    next();
}

// ============================================================
//  Helper — force-user middleware
// ============================================================
/**
 * Variant for routes that MUST have an authenticated user.
 * Use after `authMiddleware` to narrow `req.user` to non-null
 * inside the handler with a TypeScript-friendly assertion.
 *
 * In practice, if `authMiddleware` ran first, `req.user` is
 * guaranteed to be set — this is purely a convenience for
 * TypeScript types in the handler.
 */
export function requireUser(req: AuthedRequest): DecodedJwt {
    if (!req.user) {
        // Should never happen if authMiddleware ran first.
        throw new Error("requireUser called without authMiddleware");
    }
    return req.user;
}