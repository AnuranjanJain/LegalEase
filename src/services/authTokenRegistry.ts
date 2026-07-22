/**
 * Token Registry for secure in-memory token storage.
 * 
 * This module provides a centralized registry for the access token that can be
 * accessed by non-React modules (like the API client) while being managed by
 * the React AuthContext. This avoids localStorage storage for XSS protection.
 */

let currentToken: string | null = null;

/**
 * Set the current access token in the registry.
 * Called by AuthContext during login.
 */
export function setAccessToken(token: string | null): void {
  currentToken = token;
}

/**
 * Get the current access token from the registry.
 * Called by the API client to authenticate requests.
 */
export function getAccessToken(): string | null {
  return currentToken;
}

/**
 * Clear the current access token from the registry.
 * Called by AuthContext during logout.
 */
export function clearAccessToken(): void {
  currentToken = null;
}
