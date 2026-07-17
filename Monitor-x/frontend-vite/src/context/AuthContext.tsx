import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { loginRequest } from '../api/auth';
import { TOKEN_KEY } from '../api/client';
import { exitCompany as exitCompanyRequest, switchToCompany } from '../api/companies';

export type AdminRole = 'platform-owner' | 'admin' | 'staff';

export interface AuthUser {
  name: string;
  email: string;
  role: AdminRole;
  company: { id: string; code: string; name: string; logoBase64?: string } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  openCompany: (companyId: string) => Promise<void>;
  exitCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Only restore the session if we still hold a token
    const stored = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    return stored && token ? (JSON.parse(stored) as AuthUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  // client.ts fires this when any request gets a 401 (expired/invalid token)
  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout);
    return () => window.removeEventListener('auth:unauthorized', logout);
  }, [logout]);

  async function login(email: string, password: string): Promise<AuthUser> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    const { token, user: loggedIn } = await loginRequest(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(loggedIn);
    return loggedIn;
  }

  const openCompany = useCallback(async (companyId: string) => {
    const result = await switchToCompany(companyId);
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser((current) => current ? { ...current, company: result.company } : current);
  }, []);

  const exitCompany = useCallback(async () => {
    const result = await exitCompanyRequest();
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser((current) => current ? { ...current, company: null } : current);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, openCompany, exitCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
