import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { User } from '@/types';
import { authApi, tokenStorage } from '@/services/api';
import { db } from '@/utils/db';

// ─── Feature flag: use API when VITE_API_URL is set ──────────────────────────
const USE_API = !!(import.meta.env['VITE_API_URL'] as string | undefined);

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('go_session');
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user;

  // On mount: if we have an access token (API mode) verify it
  useEffect(() => {
    if (!USE_API) return;
    const token = tokenStorage.getAccess();
    if (!token) return;
    authApi.me()
      .then((me) => {
        setUser(me);
        localStorage.setItem('go_session', JSON.stringify(me));
      })
      .catch(() => {
        tokenStorage.clear();
        setUser(null);
      });
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    if (USE_API) {
      try {
        const { accessToken, refreshToken, user: apiUser } = await authApi.login(username, password);
        tokenStorage.set(accessToken, refreshToken);
        setUser(apiUser);
        localStorage.setItem('go_session', JSON.stringify(apiUser));
        return true;
      } catch {
        return false;
      }
    } else {
      // localStorage mock
      const found = db.findUserByCredentials(username, password);
      if (found) {
        setUser(found);
        localStorage.setItem('go_session', JSON.stringify(found));
        return true;
      }
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (USE_API) {
      try { await authApi.logout(); } catch { /* ignore */ }
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  // Sync user status changes (localStorage mode)
  useEffect(() => {
    if (USE_API || !user) return;
    const refreshed = db.getUsers().find((u) => u.id === user.id);
    if (refreshed && refreshed.status !== 'activo') {
      logout();
    }
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
