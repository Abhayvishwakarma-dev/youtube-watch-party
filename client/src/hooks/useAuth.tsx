// ============================================================
//  client/src/hooks/useAuth.tsx
//
//  Global authentication state via React Context.
//
//  Exports:
//    - <AuthProvider>  → wrap <App /> in main.tsx
//    - useAuth()       → consume in components
//
//  NOTE: React StrictMode in dev runs effects twice. The
//  operations here are idempotent, so we DON'T guard against
//  double-runs. The critical detail is that `setInitialized(true)`
//  must ALWAYS fire — even if a stale effect instance was
//  cancelled — otherwise the app hangs on the loading screen.
// ============================================================

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from "react";
import * as authApi from "../services/auth";
import { clearAuth, getToken, getUser } from "../utils/storage";
import {
    AuthClientError,
    LoginPayload,
    RegisterPayload,
    User,
} from "../types/auth";

// ============================================================
//  Context shape
// ============================================================

export interface AuthContextValue {
    user: User | null;
    token: string | null;
    loading: boolean;
    initialized: boolean;
    error: string | null;
    register: (payload: RegisterPayload) => Promise<User>;
    login: (payload: LoginPayload) => Promise<User>;
    logout: () => void;
    refresh: () => Promise<User | null>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
//  Provider
// ============================================================

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    // ---------- State ----------
    // Seed initial state from localStorage so the first render
    // already shows the cached user (no login-page flash on refresh).
    const [user, setUser] = useState<User | null>(() => getUser());
    const [token, setToken] = useState<string | null>(() => getToken());
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ---------- Session restore ----------
    useEffect(() => {
        // NOTE: We deliberately do NOT guard against double-invocation
        // (React StrictMode dev quirk). The operation is idempotent,
        // and we MUST allow the second effect run to call
        // setInitialized(true) in case the first was cancelled by
        // StrictMode's cleanup — otherwise the app hangs on "Loading…".

        const cachedToken = getToken();
        const cachedUser = getUser();

        // No cached credentials → nothing to verify, mark initialized.
        if (!cachedToken || !cachedUser) {
            setUser(null);
            setToken(null);
            setInitialized(true);
            return;
        }

        // Have cached credentials → verify with the server.
        let cancelled = false;

        (async () => {
            try {
                const fresh = await authApi.getMe();
                if (cancelled) return;

                if (fresh) {
                    setUser(fresh);
                    setToken(cachedToken);
                } else {
                    clearAuth();
                    setUser(null);
                    setToken(null);
                }
            } catch (err) {
                if (cancelled) return;

                if (
                    err instanceof AuthClientError &&
                    err.code === "NETWORK_ERROR"
                ) {
                    // Offline — keep cached user.
                    // eslint-disable-next-line no-console
                    console.warn(
                        "[auth] network error during session restore — keeping cached user"
                    );
                    setUser(cachedUser);
                    setToken(cachedToken);
                } else {
                    clearAuth();
                    setUser(null);
                    setToken(null);
                }
            } finally {
                // ★ CRITICAL: always mark initialized, even if this
                // effect instance was cancelled (StrictMode dev quirk).
                // Otherwise the app hangs on "Loading…".
                setInitialized(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ---------- register ----------
    const register = useCallback(
        async (payload: RegisterPayload): Promise<User> => {
            setLoading(true);
            setError(null);
            try {
                const newUser = await authApi.register(payload);
                setUser(newUser);
                setToken(getToken());
                return newUser;
            } catch (err) {
                const msg =
                    err instanceof AuthClientError
                        ? err.message
                        : "Registration failed. Please try again.";
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // ---------- login ----------
    const login = useCallback(
        async (payload: LoginPayload): Promise<User> => {
            setLoading(true);
            setError(null);
            try {
                const loggedIn = await authApi.login(payload);
                setUser(loggedIn);
                setToken(getToken());
                return loggedIn;
            } catch (err) {
                const msg =
                    err instanceof AuthClientError
                        ? err.message
                        : "Login failed. Please try again.";
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // ---------- logout ----------
    const logout = useCallback(() => {
        clearAuth();
        setUser(null);
        setToken(null);
        setError(null);

        // Disconnect the socket so the next connection starts fresh.
        void (async () => {
            try {
                const mod = await import("../services/socket");
                if (mod.socket.connected) {
                    mod.socket.disconnect();
                }
            } catch {
                /* ignore */
            }
        })();
    }, []);

    // ---------- refresh ----------
    const refresh = useCallback(async (): Promise<User | null> => {
        try {
            const fresh = await authApi.getMe();
            if (fresh) {
                setUser(fresh);
                setToken(getToken());
                return fresh;
            }
            clearAuth();
            setUser(null);
            setToken(null);
            return null;
        } catch (err) {
            if (
                err instanceof AuthClientError &&
                err.code === "NETWORK_ERROR"
            ) {
                return user;
            }
            clearAuth();
            setUser(null);
            setToken(null);
            return null;
        }
    }, [user]);

    // ---------- clearError ----------
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // ---------- Context value ----------
    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            token,
            loading,
            initialized,
            error,
            register,
            login,
            logout,
            refresh,
            clearError,
        }),
        [
            user,
            token,
            loading,
            initialized,
            error,
            register,
            login,
            logout,
            refresh,
            clearError,
        ]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

// ============================================================
//  Hook
// ============================================================

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error(
            "useAuth() must be used within an <AuthProvider>. " +
                "Wrap <App /> in main.tsx with <AuthProvider>."
        );
    }
    return ctx;
}