import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../config/api';
import { setAccessToken as setTokenInRegistry, clearAccessToken as clearTokenFromRegistry } from '../services/authTokenRegistry';

interface AuthContextType {
  isAuthenticated: boolean;
  isVerifying: boolean;
  /** Email of the authenticated user, decoded from the JWT `sub` claim. */
  userEmail: string | null;
  /** Current access token stored in memory (not persisted to localStorage). */
  accessToken: string | null;
  login: (token: string) => Promise<void>;
  logout: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Verifies the token with the backend by calling /auth/verify endpoint.
 * This ensures the token signature is valid and the user exists in the database.
 */
async function verifyTokenWithBackend(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Decodes a JWT payload without verifying its signature.
 * Returns the parsed payload object, or null if the token is malformed.
 */
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

/**
 * Checks whether a token is present and not expired.
 * Does not verify the signature; expiry check only.
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Clear any existing localStorage tokens on app load for security migration
    const existingToken = localStorage.getItem('access_token');
    if (existingToken) {
      localStorage.removeItem('access_token');
      console.log('Security: Removed legacy localStorage token for XSS protection');
    }
    sessionStorage.clear();
    
    setIsVerifying(false);
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
      setTokenInRegistry(null);
      setIsAuthenticated(false);
      setUserEmail(null);
      throw new Error('Invalid token received from server');
    }
  };

  const logout = (): boolean => {
    try {
      // Revoke the token server-side so it cannot be reused even within its expiry window.
      const token = accessToken;
      if (token) {
        // Fire-and-forget: we always clear the local session regardless of server response.
        fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch((err) => console.warn('Server-side logout failed:', err));
      }

      // Always clear local state immediately, regardless of server response
      setAccessToken(null);
      clearTokenFromRegistry();
      sessionStorage.clear();

      setIsAuthenticated(false);
      setUserEmail(null);

      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      // Ensure local state is cleared even on error
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
