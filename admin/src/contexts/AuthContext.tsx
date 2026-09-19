import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../lib/api';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  requestOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<User>('/users/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function requestOtp(phoneNumber: string) {
    await api.post('/auth/request-otp', { phoneNumber }, { auth: false });
  }

  async function verifyOtp(phoneNumber: string, otp: string) {
    // Deliberately never passes `role` — an admin account can only come
    // from the out-of-band seed script (see backend/src/scripts/create-admin.ts).
    // AuthService.verifyOtp rejects role: "admin" from any client request,
    // and this dashboard has no signup flow at all.
    const { accessToken } = await api.post<{ accessToken: string }>(
      '/auth/verify-otp',
      { phoneNumber, otp },
      { auth: false },
    );
    setToken(accessToken);
    const me = await api.get<User>('/users/me');
    if (me.role !== 'admin') {
      clearToken();
      throw new Error('This account is not an admin. Ask an existing admin to promote you.');
    }
    setUser(me);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
