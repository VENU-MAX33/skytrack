import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { loginRequest, setPasswordRequest } from '../api/auth';
import { TOKEN_KEY } from '../api/client';
import type { DriverUser } from '../api/types';

interface AuthContextValue {
  user: DriverUser | null;
  login: (phone: string, password: string) => Promise<void>;
  setPassword: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'driver_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DriverUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    return stored && token ? (JSON.parse(stored) as DriverUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [user]);

  const logout = useCallback(() => setUser(null), []);

  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout);
    return () => window.removeEventListener('auth:unauthorized', logout);
  }, [logout]);

  const login = useCallback(async (phone: string, password: string) => {
    const { token, user: u } = await loginRequest(phone, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  }, []);

  const setPassword = useCallback(async (phone: string, password: string) => {
    const { token, user: u } = await setPasswordRequest(phone, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, setPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
