// ============================================================
//  client/src/components/ProtectedRoute.tsx
//
//  Route guard for authenticated pages.
//
//  Behavior:
//    - While the initial session-restore is in flight
//      (`initialized === false`), show a loading screen.
//      This prevents the classic "flash of login page" on refresh.
//
//    - If `user` is null after initialization → redirect to /login
//      and remember where the user was trying to go (so login can
//      send them back).
//
//    - If `user` exists → render the protected children.
//
//  Usage (in App.tsx):
//    <Route
//        path="/room/:roomId"
//        element={
//            <ProtectedRoute>
//                <Room />
//            </ProtectedRoute>
//        }
//    />
// ============================================================

import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

interface Props {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
    const { user, initialized } = useAuth();
    const location = useLocation();

    // ---------- 1. Wait for session restore ----------
    // On first render, `initialized` is false while useAuth() runs
    // GET /api/auth/me in the background. Render a neutral placeholder
    // so we don't redirect a just-refreshed logged-in user to /login.
    if (!initialized) {
        return (
            <div className="loading-screen">
                Loading…
            </div>
        );
    }

    // ---------- 2. Not logged in → bounce to /login ----------
    // We pass `state.from` so the Login page can redirect back
    // to the page the user was actually trying to open.
    if (!user) {
        return (
            <Navigate
                to="/login"
                state={{ from: location }}
                replace
            />
        );
    }

    // ---------- 3. Logged in → render the protected content ----------
    return <>{children}</>;
}