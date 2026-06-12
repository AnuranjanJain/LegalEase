import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  /** Email of the authenticated user, decoded from the JWT `sub` claim. */
  userEmail: string | null;
  login: (token: string) => void;
  logout: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Decodes a JWT payload without verifying its signature.
 * Returns the parsed payload object, or null if the token is malformed.
 */
function decodeTokenPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Checks whether a token is present and not expired.
 * Does not verify the signature — expiry check only.
 */
function isTokenValid(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now();
}

/**
 * Extracts the user's email from a valid token's `sub` claim.
 * Returns null if the token is invalid or carries no email.
 */
function getEmailFromToken(token: string | null): string | null {
  if (!token || !isTokenValid(token)) return null;
  const payload = decodeTokenPayload(token);
  return typeof payload?.sub === 'string' ? payload.sub : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem('access_token');

    if (token && isTokenValid(token)) {
      return true;
    }

    if (token) {
      localStorage.removeItem('access_token');
    }

    return false;
  });

  const [userEmail, setUserEmail] = useState<string | null>(() =>
    getEmailFromToken(localStorage.getItem('access_token'))
  );

  const login = (token: string) => {
    localStorage.setItem('access_token', token);
    setIsAuthenticated(true);
    setUserEmail(getEmailFromToken(token));
  };

  const logout = (): boolean => {
    try {
      // Revoke the token server-side so it cannot be reused even within its expiry window.
      const token = localStorage.getItem('access_token');
      if (token) {
        // Fire-and-forget: we always clear the local session regardless of server response.
        fetch(`${import.meta.env.VITE_API_URL ?? ''}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch((err) => console.warn('Server-side logout failed:', err));
      }

      localStorage.removeItem('access_token');

      // Clear any other auth-related storage if present
      sessionStorage.clear();

      setIsAuthenticated(false);
      setUserEmail(null);

      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userEmail, login, logout }}>
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