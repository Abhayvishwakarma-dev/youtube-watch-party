// ============================================================
//  client/src/App.tsx
//
//  Top-level route table.
//
//  Public routes (no auth needed):
//    /login         → Login page
//    /signup        → Signup page
//
//  Protected routes (require auth):
//    /              → Home page (create or join a room)
//    /room/:roomId  → Room page (the watch party itself)
//
//  Catch-all:
//    *              → Redirect to "/"
//
//  This component lives inside <BrowserRouter> AND
//  <AuthProvider> (see main.tsx), so both routing hooks and
//  useAuth() are available in the pages it renders.
// ============================================================

import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
    return (
        <Routes>
            {/* ==============================================
                Public routes — accessible without login
                ============================================== */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* ==============================================
                Protected routes — require a logged-in user
                ============================================== */}

            {/* Home — create a new room or join an existing one */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Home />
                    </ProtectedRoute>
                }
            />

            {/* Room — the live watch party.
                :roomId is read inside Room.tsx via useParams(). */}
            <Route
                path="/room/:roomId"
                element={
                    <ProtectedRoute>
                        <Room />
                    </ProtectedRoute>
                }
            />

            {/* ==============================================
                Catch-all — unknown URLs go to Home.
                If the user is not logged in, ProtectedRoute
                on "/" will bounce them to /login.
                ============================================== */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}