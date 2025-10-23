import { describe, it, expect, vi } from 'vitest';
import { assertResponse, jsonError } from './http';

describe('HTTP utilities', () => {
  describe('assertResponse', () => {
    it('should return value when it exists', () => {
      const value = 'test-value';
      expect(assertResponse(value, 'Error')).toBe('test-value');
    });

    it('should return number when it exists', () => {
      const value = 42;
      expect(assertResponse(value, 'Error')).toBe(42);
    });

    it('should throw Response when value is null', () => {
      expect(() => assertResponse(null, 'Value not found')).toThrow(Response);
    });

    it('should throw Response when value is undefined', () => {
      expect(() => assertResponse(undefined, 'Value not found')).toThrow(
        Response,
      );
    });

    it('should throw Response when value is empty string', () => {
      expect(() => assertResponse('', 'Value not found')).toThrow(Response);
    });

    it('should use custom status code', () => {
      try {
        assertResponse(null, 'Not Found', 404);
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(404);
        }
      }
    });

    it('should use default status 400', () => {
      try {
        assertResponse(null, 'Bad Request');
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(400);
        }
      }
    });
  });

  describe('jsonError', () => {
    it('should return JSON with error message', async () => {
      const response = jsonError('Something went wrong');
      const data = await response.json();
      expect(data).toEqual({ error: 'Something went wrong' });
    });

    it('should use custom status code', async () => {
      const response = jsonError('Not Found', { status: 404 });
      expect(response.status).toBe(404);
    });

    it('should use default status 500', async () => {
      const response = jsonError('Server Error');
      expect(response.status).toBe(500);
    });

    it('should use override message if provided', async () => {
      const response = jsonError('Original', { message: 'Override' });
      const data = await response.json();
      expect(data.error).toBe('Override');
    });

    it('should accept custom headers', async () => {
      const response = jsonError('Error', {
        headers: { 'X-Custom': 'header-value' },
      });
      expect(response.headers.get('X-Custom')).toBe('header-value');
    });
  });
});
