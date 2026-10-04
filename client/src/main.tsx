// ============================================================
//  client/src/main.tsx
//
//  React root. Mounts <App /> inside:
//    1. <BrowserRouter>   → enables React Router hooks
//    2. <AuthProvider>    → provides global auth context
//                           (used by ProtectedRoute, Login,
//                            Signup, Home, etc.)
// ============================================================

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);