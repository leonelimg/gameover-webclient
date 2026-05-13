import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { User } from '@/types';
import { authApi, rolesApi, tokenStorage } from '@/services/api';
import { AxiosError } from 'axios';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  permissionsLoaded: boolean;
  permissions: string[];
  hasPermission: (resourceKey: string) => boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  permissionsLoaded: false,
  permissions: [],
  hasPermission: () => false,
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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const hasPermission = useMemo(() => {
    const permissionSet = new Set(permissions);
    return (resourceKey: string) => permissionSet.has(resourceKey);
  }, [permissions]);

  const isAuthenticated = !!user;

  // On mount: verify stored access token against the API
  useEffect(() => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;

    const token = tokenStorage.getAccess();
    if (!token) {
      setPermissionsLoaded(true);
      return;
    }

    Promise.all([authApi.me(), rolesApi.myPermissions()])
      .then(([me, userPermissions]) => {
        setUser(me);
        setPermissions(userPermissions);
        localStorage.setItem('go_session', JSON.stringify(me));
        setPermissionsLoaded(true);
      })
      .catch((err: unknown) => {
        const status = err instanceof AxiosError ? err.response?.status : undefined;
        if (status === 401 || status === 403) {
          tokenStorage.clear();
          setUser(null);
          setPermissions([]);
        }
        setPermissionsLoaded(true);
      });
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      tokenStorage.clear();
      setUser(null);
      setPermissions([]);
      setPermissionsLoaded(true);
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
      const userPermissions = await rolesApi.myPermissions();
      setPermissions(userPermissions);
      setPermissionsLoaded(true);
      localStorage.setItem('go_session', JSON.stringify(apiUser));
      return true;
    } catch {
      setPermissionsLoaded(true);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    tokenStorage.clear();
    setUser(null);
    setPermissions([]);
    setPermissionsLoaded(true);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, permissionsLoaded, permissions, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
