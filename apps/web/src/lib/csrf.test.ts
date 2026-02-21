import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/headers
const mockCookiesSet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    set: mockCookiesSet,
  }),
}));

const originalNodeEnv = process.env.NODE_ENV;

describe('CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
      return;
    }
    Reflect.set(process.env, 'NODE_ENV', originalNodeEnv);
  });

  describe('setCsrfToken', () => {
    it('should set cookies with standard names in non-production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const csrf = await import('./csrf');

      await csrf.setCsrfToken();

      expect(mockCookiesSet).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: false,
          path: '/',
        })
      );
      expect(mockCookiesSet).toHaveBeenCalledTimes(1);
    });

    it('should set cookies with __Host- prefix in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const csrf = await import('./csrf');

      await csrf.setCsrfToken();

      expect(mockCookiesSet).toHaveBeenCalledWith(
        '__Host-csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: true,
          path: '/',
        })
      );

      expect(mockCookiesSet).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: true,
          path: '/',
        })
      );
      expect(mockCookiesSet).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyCsrfToken', () => {
    it('should verify token using correct cookie name in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const csrf = await import('./csrf');

      const token = 'test-token';
      const request = new NextRequest('https://example.com', {
        headers: { 'x-csrf-token': token },
      });

      // Mock cookie retrieval
      request.cookies.get = vi
        .fn()
        .mockImplementation((name: string) =>
          name === '__Host-csrf-token' ? { value: token } : undefined
        );

      const result = await csrf.verifyCsrfToken(request);

      expect(request.cookies.get).toHaveBeenCalledWith('__Host-csrf-token');
      expect(result).toBe(true);
    });

    it('should verify token using legacy cookie name fallback in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const csrf = await import('./csrf');

      const token = 'test-token';
      const request = new NextRequest('https://example.com', {
        headers: { 'x-csrf-token': token },
      });

      request.cookies.get = vi
        .fn()
        .mockImplementation((name: string) =>
          name === 'csrf-token' ? { value: token } : undefined
        );

      const result = await csrf.verifyCsrfToken(request);

      expect(request.cookies.get).toHaveBeenCalledWith('__Host-csrf-token');
      expect(request.cookies.get).toHaveBeenCalledWith('csrf-token');
      expect(result).toBe(true);
    });

    it('should verify token using standard cookie name in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const csrf = await import('./csrf');

      const token = 'test-token';
      const request = new NextRequest('http://localhost:3000', {
        headers: { 'x-csrf-token': token },
      });

      // Mock cookie retrieval
      request.cookies.get = vi
        .fn()
        .mockImplementation((name: string) =>
          name === 'csrf-token' ? { value: token } : undefined
        );

      const result = await csrf.verifyCsrfToken(request);

      expect(request.cookies.get).toHaveBeenCalledWith('csrf-token');
      expect(result).toBe(true);
    });

    it('should return false when csrf header is missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const csrf = await import('./csrf');

      const request = new NextRequest('https://example.com');
      request.cookies.get = vi.fn();

      const result = await csrf.verifyCsrfToken(request);

      expect(result).toBe(false);
      expect(request.cookies.get).not.toHaveBeenCalled();
    });

    it('should return false when csrf cookie is missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const csrf = await import('./csrf');

      const token = 'test-token';
      const request = new NextRequest('https://example.com', {
        headers: { 'x-csrf-token': token },
      });
      request.cookies.get = vi.fn().mockReturnValue(undefined);

      const result = await csrf.verifyCsrfToken(request);

      expect(result).toBe(false);
      expect(request.cookies.get).toHaveBeenCalledWith('__Host-csrf-token');
      expect(request.cookies.get).toHaveBeenCalledWith('csrf-token');
    });

    it('should return false when csrf tokens do not match', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const csrf = await import('./csrf');

      const request = new NextRequest('http://localhost:3000', {
        headers: { 'x-csrf-token': 'header-token' },
      });
      request.cookies.get = vi
        .fn()
        .mockImplementation((name: string) =>
          name === 'csrf-token' ? { value: 'cookie-token' } : undefined
        );

      const result = await csrf.verifyCsrfToken(request);

      expect(result).toBe(false);
      expect(request.cookies.get).toHaveBeenCalledWith('csrf-token');
    });
  });
});
