import { describe, expect, it } from 'vitest';
import { getRateLimitConfig } from './rate-limit-routes';

describe('rate-limit route matching', () => {
  it('uses the polling bucket only for an exact quiz result route', () => {
    expect(
      getRateLimitConfig('/api/quiz/attempts/attempt-1/result')
    ).toMatchObject({
      pattern: '/api/quiz/attempts/:attemptId/result',
      config: { maxRequests: 120, windowMs: 60_000 },
    });
    expect(
      getRateLimitConfig('/api/quiz/attempts/attempt-1/result/details').config
        .maxRequests
    ).toBe(50);
  });

  it('keeps quiz writes and active-attempt recovery on the default bucket', () => {
    expect(
      getRateLimitConfig('/api/quiz/attempts/attempt-1/answers').config
        .maxRequests
    ).toBe(50);
    expect(
      getRateLimitConfig('/api/quiz/attempts/active').config.maxRequests
    ).toBe(50);
  });

  it('uses the most specific static prefix when no dynamic route matches', () => {
    expect(
      getRateLimitConfig('/api/storefront/auth/verify-code').config.maxRequests
    ).toBe(5);
    expect(
      getRateLimitConfig('/api/storefront/products').config.maxRequests
    ).toBe(100);
  });
});
