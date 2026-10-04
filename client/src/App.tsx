// ============================================================
//  client/src/App.tsx
//
//  Top-level route table.
//
//  Routes:
//    /              → Home page (create or join a room)
//    /room/:roomId  → Room page (the watch party itself)
//    *              → Redirect to "/"
//
//  This component lives inside <BrowserRouter> (see main.tsx),
//  so routing hooks like useNavigate / useParams work in the
//  page components it renders.
// ============================================================

import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";

export default function App() {
    return (
        <Routes>
            {/* Home — create a new room or join an existing one by code */}
            <Route path="/" element={<Home />} />

            {/* Room — the live watch party.
                :roomId is read inside Room.tsx via useParams(). */}
            <Route path="/room/:roomId" element={<Room />} />

            {/* Catch-all — any unknown URL goes back to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}