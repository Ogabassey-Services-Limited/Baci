import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

describe('Rate Limiting Logic', () => {
  it('should enforce rate limits on the same path', () => {
    // Use unique IP to isolate test - pass headers via constructor
    const req = new NextRequest('http://localhost/api/products', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    // Config for /api/products is 30 requests per minute
    const LIMIT = 30;

    // Consume all tokens
    for (let i = 0; i < LIMIT; i++) {
      const result = checkRateLimit(req);
      expect(result.allowed).toBe(true);
    }

    // Next one should be blocked
    const result = checkRateLimit(req);
    expect(result.allowed).toBe(false);
  });

  it('should enforce rate limits across dynamic paths under the same prefix', () => {
    // This test verifies the fix
    // /api/products is limited to 30
    const LIMIT = 30;
    const IP = '10.0.0.2'; // Different IP from first test

    // Request /api/products/1 30 times - pass headers via constructor
    const req1 = new NextRequest('http://localhost/api/products/1', {
      headers: { 'x-forwarded-for': IP },
    });

    for (let i = 0; i < LIMIT; i++) {
      expect(checkRateLimit(req1).allowed).toBe(true);
    }
    // 31st time is blocked for THIS path
    expect(checkRateLimit(req1).allowed).toBe(false);

    // Request to /api/products/2 SHOULD BE BLOCKED because they share the same bucket (/api/products)
    const req2 = new NextRequest('http://localhost/api/products/2', {
      headers: { 'x-forwarded-for': IP }, // Same IP
    });

    const result = checkRateLimit(req2);

    // This expects the fix to be working
    expect(result.allowed).toBe(false);
  });
});
