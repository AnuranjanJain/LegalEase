import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import React from 'react';
import {ProtectedRoute} from '../../components/ProtectedRoute';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../../contexts/AuthContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders a <ProtectedRoute> inside a MemoryRouter so that React Router
 * context (useLocation, Navigate) works in tests.
 *
 * @param isAuthenticated - controls whether the auth context reports a user
 * @param initialPath - the URL the user is "visiting" (default: /dashboard)
 */
const renderWithRouter = (
  isAuthenticated: boolean,
  initialPath = '/dashboard'
) => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated } as any);

  // ProtectedRoute typically reads auth state from a context or hook.
  // We mock the hook/context module so we can control it per test.
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute >
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        {/* The login page we expect redirects to land on */}
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  it('renders children when the user is authenticated', () => {
    renderWithRouter(true);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when the user is not authenticated', () => {
    renderWithRouter(false);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('passes state.from equal to the current pathname on redirect', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as any)
    // We capture the location state by rendering a Login component that
    // reads from useLocation.
    const LoginCapture = () => {
      
      const location = useLocation();
      const from = (location.state as { from?: string })?.from ?? 'none';
      return <div data-testid="from-state">{from}</div>;
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute >
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginCapture />} />
        </Routes>
      </MemoryRouter>
    );

    // After redirect the login page renders; the from-state should be /dashboard
    expect(screen.getByTestId('from-state').textContent).toBe('/dashboard');
  });

  it('does not redirect when the user is authenticated (no login page shown)', () => {
    renderWithRouter(true, '/dashboard');

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
