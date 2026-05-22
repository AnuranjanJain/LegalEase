import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        {/* Sleek, glowing glassmorphic loading spinner */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-full border-4 border-primary/20 dark:border-primary/10 border-t-primary animate-spin" />
          <div className="absolute w-10 h-10 rounded-full border-4 border-secondary/20 dark:border-secondary/10 border-b-secondary animate-spin animate-duration-1000 reverse-spin" />
          <div className="h-6 w-6 text-primary transition-transform animate-pulse">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
              <path d="M24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4Z" fill="currentColor" className="opacity-10" />
              <path d="M24 8C15.1634 8 8 15.1634 8 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <p className="mt-6 text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 animate-pulse">
          Securing session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save target URL for redirect after successful login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
