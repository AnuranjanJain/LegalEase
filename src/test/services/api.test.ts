import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../services/api';

describe('API Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('access_token', 'dev-token');
  });

  describe('post', () => {
    it('should make POST request with correct headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      await api.post('/test', { data: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer dev-token',
          },
          body: JSON.stringify({ data: 'test' }),
        })
      );
    });

    it('should return parsed JSON on success', async () => {
      const mockResponse = { result: 'success' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await api.post('/test', {});
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on non-OK response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Bad request' }),
      });
      global.fetch = mockFetch;

      await expect(api.post('/test', {})).rejects.toThrow('Bad request');
    });

    it('should throw error with status when JSON parsing fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });
      global.fetch = mockFetch;

      await expect(api.post('/test', {})).rejects.toThrow('API error: 500');
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      await expect(api.post('/test', {})).rejects.toThrow('Network error');
    });
  });

  describe('get', () => {
    it('should make GET request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });
      global.fetch = mockFetch;

      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    it('should return parsed JSON on success', async () => {
      const mockResponse = { data: 'test' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await api.get('/test');
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on non-OK response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Not found' }),
      });
      global.fetch = mockFetch;

      await expect(api.get('/test')).rejects.toThrow('Not found');
    });
  });

  describe('upload', () => {
    it('should make POST request with FormData', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');

      await api.upload('/upload', formData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer dev-token',
          },
          body: formData,
        })
      );
    });

    it('should return parsed JSON on success', async () => {
      const mockResponse = { filename: 'test.txt' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const formData = new FormData();
      const result = await api.upload('/upload', formData);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on non-OK response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({ detail: 'File too large' }),
      });
      global.fetch = mockFetch;

      const formData = new FormData();
      await expect(api.upload('/upload', formData)).rejects.toThrow('File too large');
    });
  });
});
