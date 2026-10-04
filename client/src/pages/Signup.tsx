// ============================================================
//  client/src/pages/Signup.tsx
//
//  Signup / registration page.
//
//  - Uses useAuth().register() which calls POST /api/auth/register
//  - Fields: username, email, password (+ confirm password)
//  - Live client-side validation via helpers from types/auth.ts
//    (same rules as backend's server/src/models/User.ts)
//  - Shows backend errors (USERNAME_TAKEN, EMAIL_TAKEN, etc.)
//  - On success: user is logged in → redirect to `from` or "/"
//
//  Backend route: POST /api/auth/register
//  Body: { username, email, password }
//  Response: 201 { user: { userId, username, email }, token }
// ============================================================

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
    AUTH_LIMITS,
    AuthClientError,
    validateEmail,
    validatePassword,
    validateUsername,
} from "../types/auth";

interface LocationState {
    from?: { pathname: string };
}

export default function Signup() {
    const navigate = useNavigate();
    const location = useLocation();
    const { register, loading, error, clearError, user, initialized } =
        useAuth();

    // ---------- Form state ----------
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Per-field "touched" flags — inline errors only shown after the
    // user has interacted with (or submitted) that field.
    const [touched, setTouched] = useState<{
        username: boolean;
        email: boolean;
        password: boolean;
        confirmPassword: boolean;
    }>({
        username: false,
        email: false,
        password: false,
        confirmPassword: false,
    });

    const [submitted, setSubmitted] = useState(false);

    // Redirect destination after successful signup.
    const from =
        (location.state as LocationState | null)?.from?.pathname ?? "/";

    // ---------- If already logged in, skip the form ----------
    useEffect(() => {
        if (initialized && user) {
            navigate(from, { replace: true });
        }
    }, [initialized, user, navigate, from]);

    // ---------- Field-level validation ----------
    const usernameError =
        touched.username || submitted ? validateUsername(username) : null;

    const emailError = touched.email || submitted ? validateEmail(email) : null;

    const passwordError =
        touched.password || submitted ? validatePassword(password) : null;

    const confirmError =
        touched.confirmPassword || submitted
            ? password !== confirmPassword
                ? "Passwords do not match."
                : null
            : null;

    const hasErrors = !!(
        usernameError ||
        emailError ||
        passwordError ||
        confirmError
    );

    // ---------- Submit ----------
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitted(true);
        clearError();

        // Mark everything touched so validation surfaces everywhere.
        setTouched({
            username: true,
            email: true,
            password: true,
            confirmPassword: true,
        });

        // Client-side validation gate — don't hit the server for
        // obviously invalid input.
        if (
            validateUsername(username) ||
            validateEmail(email) ||
            validatePassword(password) ||
            password !== confirmPassword
        ) {
            return;
        }

        try {
            await register({
                username: username.trim(),
                email: email.trim(),
                password,
            });
            // Success — useAuth has set the user; redirect.
            navigate(from, { replace: true });
        } catch (err) {
            // useAuth has set `error` in context.
            if (!(err instanceof AuthClientError)) {
                // eslint-disable-next-line no-console
                console.error("[signup] unexpected error:", err);
            }
            // Stay on the page — error is displayed via `error`.
        }
    }

    return (
        <div className="home">
            <div className="home-card">
                <h1>Create your account</h1>
                <p className="subtitle">
                    Sign up to host and join watch parties.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                    {/* ---------- Username ---------- */}
                    <label>Username</label>
                    <input
                        type="text"
                        placeholder={`Between ${AUTH_LIMITS.MIN_USERNAME_LENGTH}–${AUTH_LIMITS.MAX_USERNAME_LENGTH} characters`}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            if (error) clearError();
                        }}
                        onBlur={() =>
                            setTouched((t) => ({ ...t, username: true }))
                        }
                        autoComplete="username"
                        autoFocus
                        disabled={loading}
                        maxLength={AUTH_LIMITS.MAX_USERNAME_LENGTH}
                    />
                    {usernameError && (
                        <div className="field-error">{usernameError}</div>
                    )}

                    {/* ---------- Email ---------- */}
                    <label>Email</label>
                    <input
                        type="text"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) clearError();
                        }}
                        onBlur={() =>
                            setTouched((t) => ({ ...t, email: true }))
                        }
                        autoComplete="email"
                        disabled={loading}
                        maxLength={254}
                    />
                    {emailError && (
                        <div className="field-error">{emailError}</div>
                    )}

                    {/* ---------- Password ---------- */}
                    <label>Password</label>
                    <div className="password-row">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder={`At least ${AUTH_LIMITS.MIN_PASSWORD_LENGTH} characters`}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) clearError();
                            }}
                            onBlur={() =>
                                setTouched((t) => ({ ...t, password: true }))
                            }
                            autoComplete="new-password"
                            disabled={loading}
                            maxLength={AUTH_LIMITS.MAX_PASSWORD_LENGTH}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                            aria-label={
                                showPassword ? "Hide password" : "Show password"
                            }
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                    {passwordError && (
                        <div className="field-error">{passwordError}</div>
                    )}

                    {/* ---------- Confirm password ---------- */}
                    <label>Confirm Password</label>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (error) clearError();
                        }}
                        onBlur={() =>
                            setTouched((t) => ({ ...t, confirmPassword: true }))
                        }
                        autoComplete="new-password"
                        disabled={loading}
                        maxLength={AUTH_LIMITS.MAX_PASSWORD_LENGTH}
                    />
                    {confirmError && (
                        <div className="field-error">{confirmError}</div>
                    )}

                    {/* ---------- Server error ---------- */}
                    {error && (
                        <div className="home-error" role="alert">
                            {error}
                        </div>
                    )}

                    {/* ---------- Submit ---------- */}
                    <div className="row">
                        <button
                            type="submit"
                            className="primary"
                            disabled={loading || (submitted && hasErrors)}
                            style={{ width: "100%" }}
                        >
                            {loading ? "Creating account…" : "Create Account"}
                        </button>
                    </div>
                </form>

                <div className="divider">OR</div>

                <div className="auth-switch">
                    Already have an account?{" "}
                    <Link to="/login" state={{ from: location.state }}>
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}