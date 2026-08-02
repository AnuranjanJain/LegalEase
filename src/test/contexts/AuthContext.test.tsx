import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { clearAccessToken, getAccessToken } from '../../services/authTokenRegistry';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    refreshSession: vi.fn(),
  },
}));

const mockRefreshSession = vi.mocked(api.refreshSession);

function AuthStateProbe() {
  const { isAuthenticated, isVerifying, userEmail, accessToken, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="verifying">{String(isVerifying)}</div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="email">{userEmail ?? ''}</div>
      <div data-testid="token">{accessToken ?? ''}</div>
      <button onClick={() => void login('token')} type="button">
        login
      </button>
      <button onClick={() => logout()} type="button">
        logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a session from the refresh endpoint on startup', async () => {
    mockRefreshSession.mockResolvedValueOnce({
      access_token: createJwt({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, email: 'user@example.com' }),
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId('verifying')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('verifying')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('email')).toHaveTextContent('user@example.com');
    expect(screen.getByTestId('token').textContent).not.toBe('');
    expect(getAccessToken()).toBe(screen.getByTestId('token').textContent);
  });

  it('finishes verification unauthenticated when refresh fails', async () => {
    mockRefreshSession.mockRejectedValueOnce(new Error('refresh unavailable'));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId('verifying')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('verifying')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('email')).toHaveTextContent('');
    expect(getAccessToken()).toBeNull();
  });
});

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}
