import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = localStorage.getItem('token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const me = await api<User>('/auth/me');
      setUser(me);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function login(username: string, password: string): Promise<User> {
    const { token, user } = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
