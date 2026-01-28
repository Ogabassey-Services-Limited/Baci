import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('Rate Limit Logic', () => {
  // Clear the in-memory store before each test to prevent state leaking
  // Since checkRateLimit uses a module-level 'rateLimitStore', we need a way to reset it.
  // However, checkRateLimit cleans up expired entries.
  // Ideally, we should export a reset function for testing, but let's try to use unique IPs
  // or rely on the fact that we can't easily reset it without modifying the source.

  // "Unit tests for the middleware rate limiter are located in `apps/web/src/lib/rate-limit.test.ts`
  // and require unique `x-forwarded-for` headers for each test case to isolate the shared
  // in-memory token bucket store."

  it('should enforce default limit for unknown paths', () => {
    const req = new NextRequest('http://localhost:3000/api/unknown');
    req.headers.set('x-forwarded-for', '1.1.1.1');

    const result = checkRateLimit(req);
    expect(result.limit).toBe(50); // Default limit
  });

  it('should enforce stricter limit for newsletter subscription', () => {
    const req = new NextRequest(
      'http://localhost:3000/api/newsletter/subscribe'
    );
    req.headers.set('x-forwarded-for', '2.2.2.2'); // Unique IP

    const result = checkRateLimit(req);
    expect(result.limit).toBe(5); // Stricter limit
  });

  it('should enforce stricter limit for newsletter unsubscribe', () => {
    const req = new NextRequest(
      'http://localhost:3000/api/newsletter/unsubscribe'
    );
    req.headers.set('x-forwarded-for', '3.3.3.3'); // Unique IP

    const result = checkRateLimit(req);
    expect(result.limit).toBe(5); // Stricter limit
  });

  it('should allow requests within limit', () => {
    const ip = '4.4.4.4';
    // Newsletter limit is 5
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest(
        'http://localhost:3000/api/newsletter/subscribe'
      );
      req.headers.set('x-forwarded-for', ip);
      const result = checkRateLimit(req);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - (i + 1));
    }
  });

  it('should block requests exceeding limit', () => {
    const ip = '5.5.5.5';
    // Exhaust limit (5)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest(
        'http://localhost:3000/api/newsletter/subscribe'
      );
      req.headers.set('x-forwarded-for', ip);
      checkRateLimit(req);
    }

    // 6th request should fail
    const req = new NextRequest(
      'http://localhost:3000/api/newsletter/subscribe'
    );
    req.headers.set('x-forwarded-for', ip);
    const result = checkRateLimit(req);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
