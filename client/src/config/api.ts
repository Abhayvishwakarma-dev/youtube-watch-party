// ============================================================
//  client/src/config/api.ts
//
//  Single source of truth for the backend URL.
//
//  Resolution order:
//    1. import.meta.env.VITE_API_URL  (if set in .env or Vercel)
//    2. http://localhost:5000         (when running on localhost)
//    3. Heuristic for production      (replace "watch-party" with
//                                       "watch-party-api" in the host)
//
//  So VITE_API_URL is OPTIONAL. Leave it empty and everything
//  still works, both locally and in production.
// ============================================================

/**
 * Returns the backend base URL (no trailing slash).
 * Safe to call at any time — the value is computed once.
 */

import dotenv from "dotenv";

dotenv.config();
export function getApiUrl(): string {
    // 1) Explicit override (works in .env, Vercel, Netlify, etc.)
    const explicit = import.meta.env.VITE_API_URL as string | undefined;
    if (explicit && explicit.trim().length > 0) {
        return stripTrailingSlash(explicit.trim());
    }

    // 2) Running on the developer's machine
    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        const isLocal =
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "0.0.0.0" ||
            host.startsWith("192.168.") ||
            host.endsWith(".local");

        if (isLocal) {
            return "http://localhost:5000";
        }
    }

    // 3) Production fallback: guess based on current hostname.
    //    Frontend:  https://watch-party.onrender.com
    //    Backend:   https://watch-party-api.onrender.com
    //    (Rename your services accordingly, or set VITE_API_URL.)
    if (typeof window !== "undefined") {
        const { protocol, hostname } = window.location;

        // Common patterns: my-app / my-app-frontend / my-app-client
        //                   → my-app-api / my-app-backend
        const candidates = [
            hostname.replace(/-frontend\./, "-api."),
            hostname.replace(/-client\./, "-api."),
            hostname.replace(/^([^.]+)\./, "$1-api."),
        ];

        // Prefer the first candidate that differs from the current host.
        const guess = candidates.find((c) => c && c !== hostname);
        if (guess) {
            return `${protocol}//${guess}`;
        }

        // Ultimate fallback — same origin (in case reverse proxy).
        return `${protocol}//${hostname}`;
    }

    // 4) Server-side rendering (won't happen in Vite, but safe).
    return "http://localhost:5000";
}

function stripTrailingSlash(url: string): string {
    return url.endsWith("/") ? url.slice(0, -1) : url;
}