import { API_BASE_URL } from '../config/api';
import { setAccessToken, clearAccessToken } from './authTokenRegistry';

/**
 * Centralized access token refresh manager.
 *
 * This module ensures that all refresh operations (proactive timer, session bootstrap,
 * reactive 401 retry) share a single in-flight refresh request. This prevents race
 * conditions with refresh-token rotation backends where concurrent refresh requests
 * would invalidate each other's tokens.
 *
 * Key guarantees:
 * - Only one /auth/refresh request executes at a time
 * - Unlimited concurrent callers can safely await the same refresh
 * - Events (auth:token-refreshed, auth:session-expired) are emitted exactly once per refresh
 * - No duplicate logout events or token clears
 */

const REFRESH_ENDPOINT = '/auth/refresh';

/**
 * Shared in-flight refresh promise. All callers await this same promise
 * when a refresh is already in progress.
 */
let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Flag to track whether events have already been emitted for the current
 * in-flight refresh. This prevents duplicate events when multiple callers
 * await the same refresh.
 */
// Prevent duplicate auth events: emit token-refreshed or session-expired at most once per refresh
let eventsEmittedForCurrentRefresh = false;

/**
 * Perform an access token refresh using the HttpOnly refresh-token cookie.
 *
 * This function is the single source of truth for all refresh operations.
 * If a refresh is already in progress, concurrent callers will receive the
 * same promise, ensuring exactly one network request.
 *
 * @returns Promise that resolves to the new access token, or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in progress, return the existing promise
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  // Reset event emission flag for this new refresh
  eventsEmittedForCurrentRefresh = false;

  // Create and store the new refresh promise
  inFlightRefresh = (async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}${REFRESH_ENDPOINT}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        // Refresh failed - clear state and emit session-expired once
        handleRefreshFailure();
        return null;
      }

      const data = await response.json();
      const newToken: string | undefined = data?.access_token;
      
      if (!newToken) {
        // Invalid response - clear state and emit session-expired once
        handleRefreshFailure();
        return null;
      }

      // Success - update token and emit token-refreshed once
      setAccessToken(newToken);
      emitTokenRefreshedEvent(newToken);
      return newToken;
    } catch (error) {
      // Network error - clear state and emit session-expired once
      handleRefreshFailure();
      return null;
    } finally {
      // Clear the in-flight promise after completion
      inFlightRefresh = null;
      eventsEmittedForCurrentRefresh = false;
    }
  })();

  return inFlightRefresh;
}

/**
 * Handle refresh failure by clearing state and emitting session-expired exactly once.
 */
function handleRefreshFailure(): void {
  clearAccessToken();
  emitSessionExpiredEvent();
}

/**
 * Emit auth:token-refreshed event exactly once per refresh.
 */
function emitTokenRefreshedEvent(token: string): void {
  if (!eventsEmittedForCurrentRefresh) {
    window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: { token } }));
    eventsEmittedForCurrentRefresh = true;
  }
}

/**
 * Emit auth:session-expired event exactly once per refresh failure.
 */
function emitSessionExpiredEvent(): void {
  if (!eventsEmittedForCurrentRefresh) {
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    eventsEmittedForCurrentRefresh = true;
  }
}

/**
 * Check if a refresh is currently in progress.
 *
 * This is useful for testing and debugging, but generally not needed
 * for normal operation since callers can simply await refreshAccessToken().
 *
 * @returns true if a refresh is currently in progress
 */
export function isRefreshInProgress(): boolean {
  return inFlightRefresh !== null;
}

/**
 * Reset the refresh manager state.
 *
 * This is primarily intended for testing purposes to ensure clean state
 * between test cases. It should not be used in production code.
 */
export function resetRefreshManager(): void {
  inFlightRefresh = null;
  eventsEmittedForCurrentRefresh = false;
}
