import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRateLimitStoreForTesting, checkRateLimit } from './rate-limit';

describe('Rate Limit Logic', () => {
  // Reset the in-memory store before each test to ensure proper isolation
  beforeEach(() => {
    __resetRateLimitStoreForTesting();
  });

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

  it('should allow requests after window reset', () => {
    vi.useFakeTimers();

    const ip = '6.6.6.6';
    const NEWSLETTER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

    // Exhaust limit (5)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest(
        'http://localhost:3000/api/newsletter/subscribe'
      );
      req.headers.set('x-forwarded-for', ip);
      checkRateLimit(req);
    }

    // Verify blocked
    const blockedReq = new NextRequest(
      'http://localhost:3000/api/newsletter/subscribe'
    );
    blockedReq.headers.set('x-forwarded-for', ip);
    expect(checkRateLimit(blockedReq).allowed).toBe(false);

    // Advance time past the window (15 minutes)
    vi.advanceTimersByTime(NEWSLETTER_WINDOW_MS + 1000);

    // Now requests should be allowed again
    const newReq = new NextRequest(
      'http://localhost:3000/api/newsletter/subscribe'
    );
    newReq.headers.set('x-forwarded-for', ip);
    const result = checkRateLimit(newReq);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 - 1 = 4 remaining

    vi.useRealTimers();
  });
});
