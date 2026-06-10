import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../config/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isVerifying: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);

  useEffect(() => {
    // Verify token with backend on app startup
    const verifyStoredToken = async () => {
      const token = localStorage.getItem('access_token');

      if (!token) {
        setIsVerifying(false);
        setIsAuthenticated(false);
        return;
      }

      const isValid = await verifyTokenWithBackend(token);

      if (isValid) {
        setIsAuthenticated(true);
      } else {
        // Clear invalid token
        localStorage.removeItem('access_token');
        sessionStorage.clear();
        setIsAuthenticated(false);
      }

      setIsVerifying(false);
    };

    verifyStoredToken();
  }, []);

  const login = async (token: string) => {
    localStorage.setItem('access_token', token);
    
    // Verify token with backend before setting authenticated state
    const isValid = await verifyTokenWithBackend(token);
    
    if (isValid) {
      setIsAuthenticated(true);
    } else {
      // Clear invalid token
      localStorage.removeItem('access_token');
      sessionStorage.clear();
      setIsAuthenticated(false);
      throw new Error('Invalid token received from server');
    }
  };

  const logout = (): boolean => {
    try {
      localStorage.removeItem('access_token');

      // Clear any other auth-related storage if present
      sessionStorage.clear();

      setIsAuthenticated(false);

      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isVerifying, login, logout }}>
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