import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/apiClient";
import { setAuthToken } from "@/lib/apiClient";
import { API_ROUTES } from "@/config/api";
import type { AuthUser, LoginResponse, Role } from "@/types/models";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Token is kept in memory only (per AGENTS.md). A page refresh returns to login;
// in the Electron build this would move to secure storage.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  async function login(email: string, password: string) {
    const res = await api.post<LoginResponse>(API_ROUTES.login, { email, password });
    setAuthToken(res.token);
    setToken(res.token);
    setUser({ id: res.userId, fullName: res.fullName, role: res.role });
  }

  function logout() {
    setAuthToken(null);
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
