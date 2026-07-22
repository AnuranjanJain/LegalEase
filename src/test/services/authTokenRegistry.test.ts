import { describe, it, expect, beforeEach } from 'vitest';
import { setAccessToken, getAccessToken, clearAccessToken } from '../../services/authTokenRegistry';

describe('authTokenRegistry', () => {
  beforeEach(() => {
    // Clear the registry before each test
    clearAccessToken();
  });

  describe('setAccessToken', () => {
    it('should set a valid access token', () => {
      const token = 'test-token-123';
      setAccessToken(token);
      expect(getAccessToken()).toBe(token);
    });

    it('should overwrite existing token', () => {
      setAccessToken('first-token');
      setAccessToken('second-token');
      expect(getAccessToken()).toBe('second-token');
    });

    it('should accept null to clear token', () => {
      setAccessToken('test-token');
      setAccessToken(null);
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return null when no token is set', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('should return the set token', () => {
      const token = 'my-access-token';
      setAccessToken(token);
      expect(getAccessToken()).toBe(token);
    });
  });

  describe('clearAccessToken', () => {
    it('should clear the token', () => {
      setAccessToken('test-token');
      clearAccessToken();
      expect(getAccessToken()).toBeNull();
    });

    it('should be safe to call when no token is set', () => {
      expect(() => clearAccessToken()).not.toThrow();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('Security: localStorage isolation', () => {
    it('should not store tokens in localStorage', () => {
      const token = 'security-test-token';
      setAccessToken(token);
      
      // Verify token is NOT in localStorage
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should not read from localStorage', () => {
      // Pre-populate localStorage with a token
      localStorage.setItem('access_token', 'localStorage-token');
      
      // Registry should still return null
      expect(getAccessToken()).toBeNull();
    });
  });
});
