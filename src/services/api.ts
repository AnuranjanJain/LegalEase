const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  post: async <T>(endpoint: string, data: any, conversationHistory?: Array<{role: string, content: string}>): Promise<T> => {
    try {
      const requestData = conversationHistory ? { ...data, conversation_history: conversationHistory } : data;
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API POST error [${endpoint}]:`, error);
      throw error;
    }
  },

  get: async <T>(endpoint: string): Promise<T> => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API GET error [${endpoint}]:`, error);
      throw error;
    }
  },

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API Upload error [${endpoint}]:`, error);
      throw error;
    }
  },
};
