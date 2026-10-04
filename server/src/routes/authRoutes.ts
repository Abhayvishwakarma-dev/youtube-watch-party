// ============================================================
//  server/src/routes/authRoutes.ts
//
//  REST endpoints for authentication.
//
//  Endpoints:
//    POST /api/auth/register  → create user, return { user, token }
//    POST /api/auth/login     → verify credentials, return { user, token }
//    GET  /api/auth/me        → return current user (requires Bearer token)
//    GET  /api/auth/availability?username=...&email=...  (optional)
//
//  All errors are mapped to HTTP status codes using AuthError.statusCode.
//  Successful responses use `{ user, token }` or `{ user }` shapes
//  that match the frontend's types/auth.ts.
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import { AuthService, AuthError } from "../services/AuthService";
import { authMiddleware, AuthedRequest } from "../middleware/authMiddleware";

const router = Router();

// ============================================================
//  Error handler — translates AuthError → HTTP response
// ============================================================
function handleAuthError(err: unknown, res: Response): void {
    if (err instanceof AuthError) {
        res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
        });
        return;
    }

    // eslint-disable-next-line no-console
    console.error("[auth route] unexpected error:", err);
    res.status(500).json({
        error: "INTERNAL",
        message: "Something went wrong. Please try again.",
    });
}

// ============================================================
//  POST /api/auth/register
//  Body: { username, email, password }
//  Returns: 201 { user, token }
// ============================================================
router.post(
    "/register",
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const result = await AuthService.register({
                username: req.body?.username,
                email: req.body?.email,
                password: req.body?.password,
            });

            res.status(201).json(result);
        } catch (err) {
            handleAuthError(err, res);
        }
    }
);

// ============================================================
//  POST /api/auth/login
//  Body: { identifier, password }  (identifier = email OR username)
//  Returns: 200 { user, token }
// ============================================================
router.post(
    "/login",
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const result = await AuthService.login({
                identifier: req.body?.identifier,
                password: req.body?.password,
            });

            res.status(200).json(result);
        } catch (err) {
            handleAuthError(err, res);
        }
    }
);

// ============================================================
//  GET /api/auth/me
//  Headers: Authorization: Bearer <token>
//  Returns: 200 { user }
//         401 if token missing/invalid
//         404 if user deleted since token was issued
// ============================================================
router.get(
    "/me",
    authMiddleware,
    async (req: AuthedRequest, res: Response) => {
        try {
            const payload = req.user;
            if (!payload) {
                res.status(401).json({
                    error: "UNAUTHORIZED",
                    message: "Not authenticated.",
                });
                return;
            }

            const user = await AuthService.getMe(payload);
            if (!user) {
                res.status(404).json({
                    error: "USER_NOT_FOUND",
                    message: "Your account no longer exists.",
                });
                return;
            }

            res.status(200).json({ user });
        } catch (err) {
            handleAuthError(err, res);
        }
    }
);

// ============================================================
//  GET /api/auth/availability?username=...&email=...
//  Optional live-check for signup form.
//  Returns: 200 { usernameAvailable?: boolean, emailAvailable?: boolean }
// ============================================================
router.get(
    "/availability",
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const result = await AuthService.checkAvailability({
                username: req.query.username,
                email: req.query.email,
            });

            res.status(200).json(result);
        } catch (err) {
            handleAuthError(err, res);
        }
    }
);

export default router;