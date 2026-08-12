import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { API_BASE_URL } from '../config/api';
import { setAccessToken as setTokenInRegistry, clearAccessToken as clearTokenFromRegistry } from '../services/authTokenRegistry';
import { refreshAccessToken } from '../services/refreshManager';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// How long before a token's exp we proactively refresh it. Comfortably
// larger than typical request latency plus one retry, so a background
// refresh has time to complete before the token actually expires.
const PROACTIVE_REFRESH_MARGIN_MS = 60_000;
// Never schedule a refresh sooner than this — guards against a token
// that's already within the margin right after bootstrap.
const MIN_REFRESH_DELAY_MS = 5_000;

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

/** ms until we should proactively refresh this token, clamped to a sane minimum. */
function msUntilProactiveRefresh(token: string): number | null {
  const payload = decodeTokenPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  const expiresAtMs = payload.exp * 1000;
  const delay = expiresAtMs - Date.now() - PROACTIVE_REFRESH_MARGIN_MS;
  return Math.max(delay, MIN_REFRESH_DELAY_MS);
}

async function restoreSession(): Promise<string | null> {
  try {
    const token = await refreshAccessToken();
    if (!token || !(await verifyTokenWithBackend(token))) {
      return null;
    }

    return token;
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

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledRefresh = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  /**
   * Schedule a proactive refresh shortly before `token` expires. This is
   * the "never let the access token actually die while the tab is open"
   * half of the fix — the reactive 401-retry in api.ts is the fallback
   * for cases this timer misses (e.g. the tab was backgrounded/throttled
   * past the scheduled time).
   */
  const scheduleProactiveRefresh = (token: string) => {
    clearScheduledRefresh();
    const delay = msUntilProactiveRefresh(token);
    if (delay === null) return;

    refreshTimerRef.current = setTimeout(async () => {
      const refreshed = await restoreSession();
      if (refreshed) {
        applyToken(refreshed);
      }
      // If this failed, do nothing forceful here — the reactive 401 path
      // (and the auth:session-expired listener below) will handle logging
      // the user out the next time they actually make a request, rather
      // than forcing a logout on a transient network blip while a valid
      // refresh cookie might still exist.
    }, delay);
  };

  const applyToken = (token: string) => {
    setAccessToken(token);
    setTokenInRegistry(token);
    setIsAuthenticated(true);
    setUserEmail(getEmailFromToken(token));
    scheduleProactiveRefresh(token);
  };

  const clearSession = () => {
    clearScheduledRefresh();
    setAccessToken(null);
    clearTokenFromRegistry();
    setIsAuthenticated(false);
    setUserEmail(null);
  };

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
        applyToken(restoredToken);
      } else {
        clearSession();
      }

      setIsVerifying(false);
    };

    void bootstrap();

    return () => {
      isMounted = false;
      clearScheduledRefresh();
    };
  }, []);

  // Keep React state in sync with refreshes/expirations that happen
  // silently inside api.ts's reactive 401-retry path, which has no direct
  // access to this component's state setters.
  useEffect(() => {
    const handleTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ token: string }>).detail;
      if (detail?.token) {
        applyToken(detail.token);
      }
    };

    const handleSessionExpired = () => {
      clearSession();
    };

    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (token: string) => {
    const isValid = await verifyTokenWithBackend(token);

    if (isValid) {
      applyToken(token);
    } else {
      clearSession();
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

      clearSession();
      sessionStorage.clear();

      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      clearSession();
      sessionStorage.clear();
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