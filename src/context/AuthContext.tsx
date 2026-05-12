import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { User } from '@/types';
import { authApi, tokenStorage } from '@/services/api';
import { AxiosError } from 'axios';

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
  const hasCheckedAuthRef = useRef(false);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('go_session');
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user;

  // On mount: verify stored access token against the API
  useEffect(() => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;

    const token = tokenStorage.getAccess();
    if (!token) return;

    authApi.me()
      .then((me) => {
        setUser(me);
        localStorage.setItem('go_session', JSON.stringify(me));
      })
      .catch((err: unknown) => {
        const status = err instanceof AxiosError ? err.response?.status : undefined;
        if (status === 401 || status === 403) {
          tokenStorage.clear();
          setUser(null);
        }
      });
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      tokenStorage.clear();
      setUser(null);
    };

    window.addEventListener('go:unauthorized', onUnauthorized);
    return () => {
      window.removeEventListener('go:unauthorized', onUnauthorized);
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const { accessToken, refreshToken, user: apiUser } = await authApi.login(username, password);
      tokenStorage.set(accessToken, refreshToken);
      setUser(apiUser);
      localStorage.setItem('go_session', JSON.stringify(apiUser));
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    tokenStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
