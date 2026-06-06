const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/** Build a user-friendly error from a failed response. */
async function handleErrorResponse(response: Response, fallbackPrefix: string): Promise<never> {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 0;
    const wait = seconds > 0 ? ` Please wait ${seconds} seconds.` : '';
    throw new Error(`Too many requests.${wait}`);
  }

  const errorData = await response.json().catch(() => ({}));
  let message = '';
  if (typeof errorData?.detail === 'string') {
    message = errorData.detail;
  } else if (Array.isArray(errorData?.detail) && errorData.detail.length > 0) {
    message = errorData.detail[0]?.msg || 'Validation failed';
  } else if (errorData?.error) {
    message = errorData.error;
  } else {
    message = `${fallbackPrefix}: ${response.status}`;
  }
  throw new Error(message);
}

export const api = {
  post: async <T>(endpoint: string, data: any, conversationHistory?: Array<{role: string, content: string}>): Promise<T> => {
    const requestData = conversationHistory ? { ...data, conversation_history: conversationHistory } : data;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'API error');
    }

    return response.json();
  },

  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'API error');
    }

    return response.json();
  },

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      await handleErrorResponse(response, 'Upload error');
    }

    return response.json();
  },
};
