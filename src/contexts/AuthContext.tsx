import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem('le_auth_token');
      const storedUser = localStorage.getItem('le_auth_user');

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Verify with backend to ensure the session is still active
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data);
            localStorage.setItem('le_auth_user', JSON.stringify(data));
          } else {
            // Token is invalid/expired on backend, clear it
            handleAuthClear();
          }
        } catch (error) {
          console.error('Session restoration failed:', error);
          // If offline or network error, keep offline cache state but don't delete
        }
      }
      setLoading(false);
    }

    restoreSession();
  }, []);

  const handleAuthClear = useCallback(() => {
    localStorage.removeItem('le_auth_token');
    localStorage.removeItem('le_auth_user');
    setUser(null);
    setToken(null);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to log in. Please check your credentials.');
      }

      const data = await response.json();
      localStorage.setItem('le_auth_token', data.token);
      localStorage.setItem('le_auth_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Registration failed. Try a different email.');
      }

      // Automatically log the user in after successful registration
      await login(email, password);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem('le_auth_token');
    if (currentToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    handleAuthClear();
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
