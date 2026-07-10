import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { loginRequest } from '../api/auth';
import { TOKEN_KEY } from '../api/client';

export type AdminRole = 'admin' | 'staff';

export interface AuthUser {
  name: string;
  email: string;
  role: AdminRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  async function login(email: string, password: string): Promise<void> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    const { token, user: loggedIn } = await loginRequest(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(loggedIn);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
