import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken } from "@/lib/apiClient";
import { API_ROUTES } from "@/config/api";
import type { AuthUser, LoginResponse, Role } from "@/types/models";

/**
 * Drop-in replacement for src/contexts/AuthContext.tsx.
 * Difference: the token + user are persisted in sessionStorage, so a page refresh
 * keeps the doctor signed in, but fully closing the browser clears it.
 *
 * To use: replace the contents of src/contexts/AuthContext.tsx with this file
 * (same exports: AuthProvider, useAuth) — no other change needed in the app.
 */

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "dia.token";
const USER_KEY = "dia.user";

function readStoredToken(): string | null {
  const t = sessionStorage.getItem(TOKEN_KEY);
  if (t) setAuthToken(t); // prime apiClient on first load
  return t;
}
function readStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  async function login(email: string, password: string) {
    const res = await api.post<LoginResponse>(API_ROUTES.login, { email, password });
    const u: AuthUser = { id: res.userId, fullName: res.fullName, role: res.role };
    setAuthToken(res.token);
    sessionStorage.setItem(TOKEN_KEY, res.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(res.token);
    setUser(u);
  }

  function logout() {
    setAuthToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      login,
      logout,
      hasRole: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
