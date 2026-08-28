import { API_BASE_URL } from '../config/api';
import { getAccessToken } from './authTokenRegistry';
import { refreshAccessToken } from './refreshManager';

const getAuthHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const includeCredentials = (init?: RequestInit): RequestInit => ({
  ...init,
  credentials: 'include',
});

export interface NotificationResponse {
  id: number;
  title: string;
  description: string | null;
  type: 'document' | 'security' | 'system';
  read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  unread_count: number;
}

/** Build a user-friendly error from a failed response. */
async function handleErrorResponse(response: Response, fallbackPrefix: string): Promise<never> {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 0;
    const wait = seconds > 0 ? ` Please wait ${seconds} seconds.` : '';
    throw new Error(`Too many requests.${wait}`);
  }

  const responseText = typeof response.text === 'function'
    ? await response.text().catch(() => '')
    : '';
  let errorData: any = {};
  try {
    errorData = responseText ? JSON.parse(responseText) : {};
  } catch {
    // Vercel returns plain text for a function invocation failure.
  }
  if (!responseText && typeof response.json === 'function') {
    errorData = await response.json().catch(() => ({}));
  }
  let message = '';
  if (typeof errorData?.detail === 'string') {
    message = errorData.detail;
  } else if (Array.isArray(errorData?.detail) && errorData.detail.length > 0) {
    message = errorData.detail[0]?.msg || 'Validation failed';
  } else if (errorData?.error) {
    message = errorData.error;
  } else if (responseText.includes('FUNCTION_INVOCATION_FAILED')) {
    message = 'The server failed to start. Check the deployment environment variables and function logs.';
  } else {
    message = `${fallbackPrefix}: ${response.status}`;
  }
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Automatic access-token refresh on 401.
//
// Previously, a 401 from an expired access token was a dead end: nothing in
// this file (or AuthContext) retried after refreshing, so every call failed
// until the user manually reloaded the page. This module now transparently
// refreshes once via the HttpOnly refresh-token cookie and retries the
// original request. If the refresh itself fails (refresh token also
// expired/revoked), the failure is surfaced as an 'auth:session-expired'
// window event so AuthContext can update isAuthenticated/userEmail without
// this module needing direct access to React state.
//
// All refresh operations are now coordinated through refreshManager to
// prevent race conditions with refresh-token rotation backends.
// ---------------------------------------------------------------------------

const REFRESH_ENDPOINT = '/auth/refresh';

/**
 * Perform a fetch with the current access token attached. On a 401,
 * attempt exactly one refresh-and-retry before giving up. Never retries
 * the refresh endpoint itself (would recurse forever).
 */
async function fetchWithAuthRetry(
  buildRequest: () => RequestInit,
  endpoint: string,
  fallbackPrefix: string
): Promise<Response> {
  let response = await fetch(`${API_BASE_URL}${endpoint}`, buildRequest());

  if (response.status === 401 && endpoint !== REFRESH_ENDPOINT) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await fetch(`${API_BASE_URL}${endpoint}`, buildRequest());
    }
  }

  if (!response.ok) {
    await handleErrorResponse(response, fallbackPrefix);
  }

  return response;
}

export const api = {
  post: async <T>(endpoint: string, data: any, conversationHistory?: Array<{role: string, content: string}>): Promise<T> => {
    const requestData = conversationHistory ? { ...data, conversation_history: conversationHistory } : data;
    const response = await fetchWithAuthRetry(
      () => ({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(requestData),
      }),
      endpoint,
      'API error'
    );

    return response.json();
  },

  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetchWithAuthRetry(
      () => ({
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
      }),
      endpoint,
      'API error'
    );

    return response.json();
  },

  put: async <T>(endpoint: string, data?: any): Promise<T> => {
    const response = await fetchWithAuthRetry(
      () => ({
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: data ? JSON.stringify(data) : undefined,
      }),
      endpoint,
      'API error'
    );

    return response.json();
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const response = await fetchWithAuthRetry(
      () => ({
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
      }),
      endpoint,
      'API error'
    );

    return response.json();
  },

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const response = await fetchWithAuthRetry(
      () => ({
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      }),
      endpoint,
      'Upload error'
    );

    return response.json();
  },

  postBlob: async (endpoint: string, data: any): Promise<Blob> => {
    const response = await fetchWithAuthRetry(
      () => ({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      }),
      endpoint,
      'Export error'
    );

    return response.blob();
  },

  stream: async (endpoint: string, data: any, conversationHistory?: Array<{role: string, content: string}>): Promise<Response> => {
    const requestData = conversationHistory ? { ...data, conversation_history: conversationHistory, stream: true } : { ...data, stream: true };
    const response = await fetchWithAuthRetry(
      () => ({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(requestData),
      }),
      endpoint,
      'API error'
    );

    return response;
  },

  /**
   * Attempt to restore the current session using an HttpOnly refresh-token cookie.
   * Backend: GET /auth/refresh (backend/routers/auth_routes.py) — fully
   * implemented (signature/expiry/revocation checks, rotation). Used both
   * for initial session bootstrap (AuthContext) and internally by
   * fetchWithAuthRetry's 401 handling above.
   */
  refreshSession: async <T>(endpoint = '/auth/refresh', method: 'GET' | 'POST' = 'GET'): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, includeCredentials({ method }));

    if (!response.ok) {
      await handleErrorResponse(response, 'Refresh error');
    }

    return response.json();
  },

  // Notification API methods
  notifications: {
    getAll: async (): Promise<NotificationListResponse> => {
      return api.get<NotificationListResponse>('/notifications');
    },

    markRead: async (notificationId: number): Promise<{ detail: string }> => {
      return api.post<{ detail: string }>(`/notifications/${notificationId}/read`, {});
    },

    markAllRead: async (): Promise<{ detail: string }> => {
      return api.post<{ detail: string }>('/notifications/read-all', {});
    },

    delete: async (notificationId: number): Promise<{ detail: string }> => {
      return api.delete<{ detail: string }>(`/notifications/${notificationId}`);
    },

    create: async (data: { title: string; description?: string; type: string }): Promise<NotificationResponse> => {
      return api.post<NotificationResponse>('/notifications', data);
    },
  },
};
