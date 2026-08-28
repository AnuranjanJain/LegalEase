const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');

export const API_BASE_URL =
  configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');
