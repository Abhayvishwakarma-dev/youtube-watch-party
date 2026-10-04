// ============================================================
//  client/src/pages/Login.tsx
//
//  Login page.
//
//  - Uses useAuth().login() which calls POST /api/auth/login
//  - Accepts EITHER email OR username in the identifier field
//    (backend's User.findByEmailOrUsername supports both)
//  - Redirects to `location.state.from` after success, or to
//    "/" by default
//  - Shows backend error messages (INVALID_CREDENTIALS, etc.)
//  - Live client-side validation via helpers from types/auth.ts
//
//  Corresponds to backend route: POST /api/auth/login
//  Body: { identifier, password }
//  Response: { user: { userId, username, email }, token }
// ============================================================

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuthClientError } from "../types/auth";

interface LocationState {
    from?: { pathname: string };
}

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, loading, error, clearError, user, initialized } = useAuth();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState(false);

    // Where to redirect after successful login.
    const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

    // If the user is already logged in, don't show the form — just redirect.
    // (E.g. user bookmarked /login, opens it while authenticated.)
    useEffect(() => {
        if (initialized && user) {
            navigate(from, { replace: true });
        }
    }, [initialized, user, navigate, from]);

    // Clear any lingering error from a previous attempt when the user
    // starts typing again — feels more responsive.
    useEffect(() => {
        if (error && (identifier || password)) {
            // We intentionally do NOT clear on every keystroke to avoid
            // flickering while the user is fixing the input. Only clear
            // if they are actively changing the fields after an error.
        }
    }, [identifier, password, error]);

    // Local validation — only shown after the first submit attempt.
    const identifierError = touched && !identifier.trim()
        ? "Enter your email or username."
        : null;
    const passwordError = touched && !password
        ? "Enter your password."
        : null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setTouched(true);
        clearError();

        // ---------- Client-side validation ----------
        if (!identifier.trim() || !password) {
            return;
        }

        // ---------- Server call via useAuth ----------
        try {
            await login({
                identifier: identifier.trim(),
                password,
            });
            // Success — useAuth has set the user; navigate.
            navigate(from, { replace: true });
        } catch (err) {
            // useAuth has already set `error` in context.
            // We just log for debugging if it's an unexpected shape.
            if (!(err instanceof AuthClientError)) {
                // eslint-disable-next-line no-console
                console.error("[login] unexpected error:", err);
            }
            // Stay on the page — the error is displayed via `error`.
        }
    }

    return (
        <div className="home">
            <div className="home-card">
                <h1>Welcome back</h1>
                <p className="subtitle">
                    Sign in to join or create a watch party.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                    <label>Email or Username</label>
                    <input
                        type="text"
                        placeholder="you@example.com or abhay"
                        value={identifier}
                        onChange={(e) => {
                            setIdentifier(e.target.value);
                            if (error) clearError();
                        }}
                        autoComplete="username"
                        autoFocus
                        disabled={loading}
                        maxLength={254}
                    />
                    {identifierError && (
                        <div className="field-error">{identifierError}</div>
                    )}

                    <label>Password</label>
                    <div className="password-row">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) clearError();
                            }}
                            autoComplete="current-password"
                            disabled={loading}
                            maxLength={128}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                    {passwordError && (
                        <div className="field-error">{passwordError}</div>
                    )}

                    {error && (
                        <div className="home-error" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="row">
                        <button
                            type="submit"
                            className="primary"
                            disabled={loading}
                            style={{ width: "100%" }}
                        >
                            {loading ? "Signing in…" : "Sign In"}
                        </button>
                    </div>
                </form>

                <div className="divider">OR</div>

                <div className="auth-switch">
                    Don&apos;t have an account?{" "}
                    <Link to="/signup" state={{ from: location.state }}>
                        Create one
                    </Link>
                </div>
            </div>
        </div>
    );
}