import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshAccessToken, isRefreshInProgress, resetRefreshManager } from '../../services/refreshManager';
import { setAccessToken, clearAccessToken, getAccessToken } from '../../services/authTokenRegistry';

describe('refreshManager', () => {
  beforeEach(() => {
    // Reset refresh manager state before each test
    resetRefreshManager();
    clearAccessToken();
    vi.restoreAllMocks();
  });

  describe('Successful refresh', () => {
    it('should successfully refresh and return new token', async () => {
      const newToken = 'new-access-token-123';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBe(newToken);
      expect(getAccessToken()).toBe(newToken);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should emit auth:token-refreshed event on success', async () => {
      const newToken = 'new-access-token-123';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const eventListener = vi.fn();
      window.addEventListener('auth:token-refreshed', eventListener);

      await refreshAccessToken();

      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { token: newToken }
        })
      );

      window.removeEventListener('auth:token-refreshed', eventListener);
    });

    it('should handle bootstrap refresh scenario', async () => {
      const newToken = 'bootstrap-token';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      // Simulate bootstrap: no token initially, then refresh
      expect(getAccessToken()).toBeNull();
      
      const result = await refreshAccessToken();

      expect(result).toBe(newToken);
      expect(getAccessToken()).toBe(newToken);
    });

    it('should handle proactive refresh scenario', async () => {
      const initialToken = 'initial-token';
      const newToken = 'proactive-refresh-token';
      
      setAccessToken(initialToken);
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBe(newToken);
      expect(getAccessToken()).toBe(newToken);
      expect(getAccessToken()).not.toBe(initialToken);
    });

    it('should handle reactive refresh scenario (401 response)', async () => {
      const newToken = 'reactive-refresh-token';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBe(newToken);
      expect(getAccessToken()).toBe(newToken);
    });
  });

  describe('Concurrent refreshes', () => {
    it('should deduplicate concurrent refresh calls', async () => {
      const newToken = 'concurrent-token';
      let fetchCallCount = 0;
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      // Trigger multiple concurrent refreshes
      const promises = [
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ];

      const results = await Promise.all(promises);

      // All should return the same token
      expect(results).toEqual([newToken, newToken, newToken, newToken, newToken]);
      // But only one network request should have been made
      expect(fetchCallCount).toBe(1);
    });

    it('should handle concurrent callers with different timing', async () => {
      const newToken = 'timing-token';
      let fetchCallCount = 0;
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      // Stagger the calls
      const promise1 = refreshAccessToken();
      await new Promise(resolve => setTimeout(resolve, 10));
      const promise2 = refreshAccessToken();
      await new Promise(resolve => setTimeout(resolve, 10));
      const promise3 = refreshAccessToken();

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual([newToken, newToken, newToken]);
      expect(fetchCallCount).toBe(1);
    });

    it('should emit token-refreshed event only once for concurrent calls', async () => {
      const newToken = 'event-token';
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      const eventListener = vi.fn();
      window.addEventListener('auth:token-refreshed', eventListener);

      // Trigger concurrent refreshes
      await Promise.all([
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]);

      // Event should be emitted exactly once
      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { token: newToken }
        })
      );

      window.removeEventListener('auth:token-refreshed', eventListener);
    });

    it('should handle proactive timer and 401 retry simultaneously', async () => {
      const newToken = 'race-token';
      let fetchCallCount = 0;
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      // Simulate proactive timer firing
      const proactiveRefresh = refreshAccessToken();
      
      // Simulate 401 retry happening at the same time
      await new Promise(resolve => setTimeout(resolve, 5));
      const reactiveRefresh = refreshAccessToken();

      const [result1, result2] = await Promise.all([proactiveRefresh, reactiveRefresh]);

      expect(result1).toBe(newToken);
      expect(result2).toBe(newToken);
      expect(fetchCallCount).toBe(1);
    });
  });

  describe('Refresh failure', () => {
    it('should return null on refresh failure (401 from refresh endpoint)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it('should return null on refresh failure (500 error)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it('should return null on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it('should return null on invalid response (no access_token)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'invalid' }),
      });
      (global as any).fetch = mockFetch;

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it('should emit auth:session-expired event once on failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      (global as any).fetch = mockFetch;

      const eventListener = vi.fn();
      window.addEventListener('auth:session-expired', eventListener);

      await refreshAccessToken();

      expect(eventListener).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth:session-expired', eventListener);
    });

    it('should clear access token on failure', async () => {
      setAccessToken('old-token');
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      (global as any).fetch = mockFetch;

      await refreshAccessToken();

      expect(getAccessToken()).toBeNull();
    });

    it('should reject all concurrent callers on failure', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          ok: false,
          status: 401,
        };
      });
      (global as any).fetch = mockFetch;

      const promises = [
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([null, null, null]);
    });

    it('should emit session-expired only once for concurrent failures', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          ok: false,
          status: 401,
        };
      });
      (global as any).fetch = mockFetch;

      const eventListener = vi.fn();
      window.addEventListener('auth:session-expired', eventListener);

      await Promise.all([
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]);

      expect(eventListener).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth:session-expired', eventListener);
    });
  });

  describe('Rotation compatibility', () => {
    it('should never issue duplicate refresh requests', async () => {
      const newToken = 'rotation-token';
      let fetchCallCount = 0;
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      // Simulate heavy concurrent load
      const promises = Array.from({ length: 10 }, () => refreshAccessToken());
      
      await Promise.all(promises);

      expect(fetchCallCount).toBe(1);
    });

    it('should not cause false logout on concurrent success', async () => {
      const newToken = 'no-false-logout-token';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const sessionExpiredListener = vi.fn();
      window.addEventListener('auth:session-expired', sessionExpiredListener);

      await Promise.all([
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]);

      // Should NOT emit session-expired on success
      expect(sessionExpiredListener).not.toHaveBeenCalled();

      window.removeEventListener('auth:session-expired', sessionExpiredListener);
    });

    it('should handle sequential refreshes correctly', async () => {
      const token1 = 'token-1';
      const token2 = 'token-2';
      
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        const token = callCount === 1 ? token1 : token2;
        return {
          ok: true,
          json: async () => ({ access_token: token }),
        };
      });
      (global as any).fetch = mockFetch;

      const result1 = await refreshAccessToken();
      expect(result1).toBe(token1);
      expect(callCount).toBe(1);

      const result2 = await refreshAccessToken();
      expect(result2).toBe(token2);
      expect(callCount).toBe(2);
    });
  });

  describe('Event tests', () => {
    it('should emit auth:token-refreshed with correct token', async () => {
      const newToken = 'event-test-token';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const eventListener = vi.fn();
      window.addEventListener('auth:token-refreshed', eventListener);

      await refreshAccessToken();

      expect(eventListener).toHaveBeenCalledTimes(1);
      const event = eventListener.mock.calls[0][0];
      expect(event.detail.token).toBe(newToken);

      window.removeEventListener('auth:token-refreshed', eventListener);
    });

    it('should emit auth:session-expired on refresh failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      (global as any).fetch = mockFetch;

      const eventListener = vi.fn();
      window.addEventListener('auth:session-expired', eventListener);

      await refreshAccessToken();

      expect(eventListener).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth:session-expired', eventListener);
    });

    it('should handle multiple event listeners correctly', async () => {
      const newToken = 'multi-listener-token';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      window.addEventListener('auth:token-refreshed', listener1);
      window.addEventListener('auth:token-refreshed', listener2);
      window.addEventListener('auth:token-refreshed', listener3);

      await refreshAccessToken();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth:token-refreshed', listener1);
      window.removeEventListener('auth:token-refreshed', listener2);
      window.removeEventListener('auth:token-refreshed', listener3);
    });
  });

  describe('Regression tests', () => {
    it('should maintain only one refresh promise at a time', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          ok: true,
          json: async () => ({ access_token: 'test-token' }),
        };
      });
      (global as any).fetch = mockFetch;

      // Start first refresh
      const promise1 = refreshAccessToken();
      expect(isRefreshInProgress()).toBe(true);

      // Second call should return the same promise (deduplication)
      const promise2 = refreshAccessToken();
      expect(isRefreshInProgress()).toBe(true);

      // Both should resolve to the same value
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(result2);
      expect(result1).toBe('test-token');
      
      // Only one fetch call should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await promise1;
      await promise2;
      expect(isRefreshInProgress()).toBe(false);
    });

    it('should not create refresh storms under heavy load', async () => {
      const newToken = 'storm-test-token';
      let fetchCallCount = 0;
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      // Simulate 50 concurrent refresh requests
      const promises = Array.from({ length: 50 }, () => refreshAccessToken());
      
      await Promise.all(promises);

      // Should still only make one network request
      expect(fetchCallCount).toBe(1);
    });

    it('should handle race between timer and 401 retry correctly', async () => {
      const newToken = 'race-condition-token';
      let fetchCallCount = 0;
      
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        await new Promise(resolve => setTimeout(resolve, 25));
        return {
          ok: true,
          json: async () => ({ access_token: newToken }),
        };
      });
      (global as any).fetch = mockFetch;

      // Simulate proactive timer
      const timerRefresh = refreshAccessToken();
      
      // Simulate multiple 401 retries happening concurrently
      await new Promise(resolve => setTimeout(resolve, 5));
      const retry1 = refreshAccessToken();
      const retry2 = refreshAccessToken();
      const retry3 = refreshAccessToken();

      const results = await Promise.all([timerRefresh, retry1, retry2, retry3]);

      expect(results.every(r => r === newToken)).toBe(true);
      expect(fetchCallCount).toBe(1);
    });

    it('should maintain consistent auth state under concurrency', async () => {
      const newToken = 'consistent-state-token';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: newToken }),
      });
      (global as any).fetch = mockFetch;

      const promises = Array.from({ length: 20 }, () => refreshAccessToken());
      
      await Promise.all(promises);

      // All callers should see the same final state
      expect(getAccessToken()).toBe(newToken);
    });

    it('should clear stale promises after completion', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      });
      (global as any).fetch = mockFetch;

      await refreshAccessToken();
      
      expect(isRefreshInProgress()).toBe(false);

      // Should be able to start a new refresh
      const mockFetch2 = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token-2' }),
      });
      (global as any).fetch = mockFetch2;

      await refreshAccessToken();
      
      expect(isRefreshInProgress()).toBe(false);
      expect(mockFetch2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Utility functions', () => {
    it('isRefreshInProgress should return correct state', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          ok: true,
          json: async () => ({ access_token: 'test-token' }),
        };
      });
      (global as any).fetch = mockFetch;

      expect(isRefreshInProgress()).toBe(false);

      const promise = refreshAccessToken();
      expect(isRefreshInProgress()).toBe(true);

      await promise;
      expect(isRefreshInProgress()).toBe(false);
    });

    it('resetRefreshManager should clear state', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          ok: true,
          json: async () => ({ access_token: 'test-token' }),
        };
      });
      (global as any).fetch = mockFetch;

      const promise = refreshAccessToken();
      expect(isRefreshInProgress()).toBe(true);

      resetRefreshManager();
      expect(isRefreshInProgress()).toBe(false);

      // Reset should not affect the in-flight promise's ability to complete
      // (though in production this should only be used in tests)
      await promise;
    });
  });
});
