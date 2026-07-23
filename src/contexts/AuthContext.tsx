import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { API_BASE_URL } from '../config/api';
import { api } from '../services/api';
import { setAccessToken as setTokenInRegistry, clearAccessToken as clearTokenFromRegistry } from '../services/authTokenRegistry';

interface AuthContextType {
  isAuthenticated: boolean;
  isVerifying: boolean;
  /** Email of the authenticated user, decoded from the JWT `sub` claim. */
  userEmail: string | null;
  /** Current access token stored in memory only. */
  accessToken: string | null;
  login: (token: string) => Promise<void>;
  logout: () => boolean;
}

interface RefreshResponse {
  access_token: string;
  token_type?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function verifyTokenWithBackend(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

function decodeTokenPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now();
}

function getEmailFromToken(token: string | null): string | null {
  if (!token || !isTokenValid(token)) return null;
  const payload = decodeTokenPayload(token);
  return typeof payload?.sub === 'string' ? payload.sub : null;
}

async function restoreSession(): Promise<string | null> {
  try {
    const response = await api.refreshSession<RefreshResponse>();
    if (!response?.access_token || !(await verifyTokenWithBackend(response.access_token))) {
      return null;
    }

    return response.access_token;
  } catch (error) {
    console.warn('Session restore failed; continuing unauthenticated.', error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      // Clear any legacy browser-stored auth artifacts. Access tokens remain in memory only.
      const legacyToken = localStorage.getItem('access_token');
      if (legacyToken) {
        localStorage.removeItem('access_token');
        console.log('Security: Removed legacy localStorage token for XSS protection');
      }
      sessionStorage.clear();

      const restoredToken = await restoreSession();
      if (!isMounted) return;

      if (restoredToken) {
        setAccessToken(restoredToken);
        setTokenInRegistry(restoredToken);
        setIsAuthenticated(true);
        setUserEmail(getEmailFromToken(restoredToken));
      } else {
        setAccessToken(null);
        clearTokenFromRegistry();
        setIsAuthenticated(false);
        setUserEmail(null);
      }

      setIsVerifying(false);
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (token: string) => {
    const isValid = await verifyTokenWithBackend(token);

    if (isValid) {
      setAccessToken(token);
      setTokenInRegistry(token);
      setIsAuthenticated(true);
      setUserEmail(getEmailFromToken(token));
    } else {
      setAccessToken(null);
      clearTokenFromRegistry();
      setIsAuthenticated(false);
      setUserEmail(null);
      throw new Error('Invalid token received from server');
    }
  };

  const logout = (): boolean => {
    try {
      const token = accessToken;
      if (token) {
        fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch((err) => console.warn('Server-side logout failed:', err));
      }

      setAccessToken(null);
      clearTokenFromRegistry();
      sessionStorage.clear();
      setIsAuthenticated(false);
      setUserEmail(null);

      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      setAccessToken(null);
      clearTokenFromRegistry();
      sessionStorage.clear();
      setIsAuthenticated(false);
      setUserEmail(null);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isVerifying, userEmail, accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
