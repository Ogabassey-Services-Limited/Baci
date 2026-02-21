import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/headers
const mockCookiesSet = vi.fn();
const mockCookiesGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    set: mockCookiesSet,
    get: mockCookiesGet,
  }),
}));

describe('CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('setCsrfToken', () => {
    it('should set cookies with standard names in non-production', async () => {
      process.env.NODE_ENV = 'development';
      const csrf = await import('./csrf');

      await csrf.setCsrfToken();

      expect(mockCookiesSet).toHaveBeenCalledWith(
        'csrf-secret',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: false, // In development, secure is false
        })
      );

      expect(mockCookiesSet).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: false,
        })
      );
    });

    it('should set cookies with __Host- prefix in production', async () => {
      process.env.NODE_ENV = 'production';
      const csrf = await import('./csrf');

      await csrf.setCsrfToken();

      expect(mockCookiesSet).toHaveBeenCalledWith(
        '__Host-csrf-secret',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: true,
        })
      );

      expect(mockCookiesSet).toHaveBeenCalledWith(
        '__Host-csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: true,
        })
      );
    });
  });

  describe('verifyCsrfToken', () => {
    it('should verify token using correct cookie name in production', async () => {
      process.env.NODE_ENV = 'production';
      const csrf = await import('./csrf');

      const token = 'test-token';
      const request = new NextRequest('https://example.com', {
        headers: { 'x-csrf-token': token },
      });

      // Mock cookie retrieval
      request.cookies.get = vi.fn().mockReturnValue({ value: token });

      const result = await csrf.verifyCsrfToken(request);

      expect(request.cookies.get).toHaveBeenCalledWith('__Host-csrf-token');
      expect(result).toBe(true);
    });

    it('should verify token using standard cookie name in development', async () => {
      process.env.NODE_ENV = 'development';
      const csrf = await import('./csrf');

      const token = 'test-token';
      const request = new NextRequest('http://localhost:3000', {
        headers: { 'x-csrf-token': token },
      });

      // Mock cookie retrieval
      request.cookies.get = vi.fn().mockReturnValue({ value: token });

      const result = await csrf.verifyCsrfToken(request);

      expect(request.cookies.get).toHaveBeenCalledWith('csrf-token');
      expect(result).toBe(true);
    });
  });
});
