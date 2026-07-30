import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { devLogin, devRegister, logout as apiLogout } from '../api/client.js';
import { getSession, type ParentSession } from '../auth/session.js';

interface AuthContextValue {
  session: ParentSession | null;
  login: () => Promise<void>;
  register: (email: string) => Promise<void>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSessionState] = useState<ParentSession | null>(() => getSession());

  const refresh = useCallback(() => {
    setSessionState(getSession());
  }, []);

  const login = useCallback(async () => {
    await devLogin();
    refresh();
  }, [refresh]);

  const register = useCallback(
    async (email: string) => {
      await devRegister(email);
      refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    apiLogout();
    setSessionState(null);
  }, []);

  const value = useMemo(
    () => ({ session, login, register, logout, refresh }),
    [session, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
