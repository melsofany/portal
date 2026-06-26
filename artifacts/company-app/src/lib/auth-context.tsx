import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

    export type Permissions = Record<string, boolean>;

    export interface AuthUser {
      userId: number;
      username: string;
      fullName: string;
      role: string;
      photoUrl?: string;
      permissions: Permissions;
    }

    interface AuthContextType {
      user: AuthUser | null;
      isLoading: boolean;
      token: string | null;
      sessionError: string | null;
      login: (email: string, password: string) => Promise<void>;
      logout: () => Promise<void>;
      updateUser: (data: Partial<AuthUser>) => void;
      hasPermission: (key: string) => boolean;
    }

    const AuthContext = createContext<AuthContextType | null>(null);

    export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

    const TOKEN_KEY = "auth_token";
    function getStoredToken(): string | null {
      try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
    }
    function setStoredToken(t: string) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
    function clearStoredToken() { try { localStorage.removeItem(TOKEN_KEY); } catch {} }

    function parsePerms(raw: string | null | undefined): Permissions {
      try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
    }

    function buildUser(data: any): AuthUser {
      return {
        userId: data.userId,
        username: data.username,
        fullName: data.fullName || "",
        role: data.role,
        photoUrl: data.photoUrl || "",
        permissions: typeof data.permissions === "object" && data.permissions !== null
          ? data.permissions
          : parsePerms(data.permissions),
      };
    }

    export function AuthProvider({ children }: { children: React.ReactNode }) {
      const [user, setUser] = useState<AuthUser | null>(null);
      const [token, setToken] = useState<string | null>(getStoredToken);
      const [isLoading, setIsLoading] = useState(true);
      const [sessionError, setSessionError] = useState<string | null>(null);

      useEffect(() => {
        const storedToken = getStoredToken();
        const headers: Record<string, string> = {};
        if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

        fetch(`${API_BASE}/api/auth/me`, { credentials: "include", headers })
          .then(async (r) => {
            if (r.status === 401) {
              const body = await r.json().catch(() => ({}));
              if (body?.error?.includes("جهاز آخر")) setSessionError(body.error);
              clearStoredToken();
              setToken(null);
              return null;
            }
            return r.ok ? r.json() : null;
          })
          .then((data) => setUser(data ? buildUser(data) : null))
          .catch(() => setUser(null))
          .finally(() => setIsLoading(false));
      }, []);

      const login = useCallback(async (email: string, password: string) => {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "فشل تسجيل الدخول");
        }
        const data = await res.json();
        if (data.token) { setStoredToken(data.token); setToken(data.token); }
        setSessionError(null);
        setUser(buildUser(data));
      }, []);

      const logout = useCallback(async () => {
        const storedToken = getStoredToken();
        const headers: Record<string, string> = {};
        if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
        await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include", headers }).catch(() => {});
        clearStoredToken();
        setToken(null);
        setUser(null);
      }, []);

      const updateUser = useCallback((data: Partial<AuthUser>) => {
        setUser((prev) => (prev ? { ...prev, ...data } : prev));
      }, []);

      // Admin always has all permissions; non-admin checks the permissions map
      const hasPermission = useCallback((key: string): boolean => {
        if (!user) return false;
        if (user.role === "admin") return true;
        return !!user.permissions[key];
      }, [user]);

      return (
        <AuthContext.Provider value={{ user, isLoading, token, sessionError, login, logout, updateUser, hasPermission }}>
          {children}
        </AuthContext.Provider>
      );
    }

    export function useAuth(): AuthContextType {
      const ctx = useContext(AuthContext);
      if (!ctx) throw new Error("useAuth must be used within AuthProvider");
      return ctx;
    }
