import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetRateLimitStoreForTesting,
  checkImeiPollRateLimit,
  checkRateLimit,
  setRateLimitDiagnosticHook,
} from './rate-limit';

// Dedicated coverage for the quiz-specific rate-limit entries added for launch.
// The broader per-IP identifier / trie behavior is covered in rate-limit.test.tsx.
describe('quiz route rate limits', () => {
  beforeEach(() => {
    __resetRateLimitStoreForTesting();
  });

  afterEach(() => {
    __resetRateLimitStoreForTesting();
  });

  it.each([
    ['/api/merchant/quiz/generate', 5],
    ['/api/quiz/attempts/start', 20],
    ['/api/quiz/awards/cash/claim', 10],
    ['/api/quiz/prizes/grand/claim', 10],
  ])('applies a dedicated limit to %s', async (path, expectedLimit) => {
    const result = await checkRateLimit(
      new NextRequest(`http://localhost:3000${path}`)
    );

    expect(result.limit).toBe(expectedLimit);
  });

  it.each([
    ['/api/quiz/attempts/attempt-1/answers', 50],
    ['/api/quiz/attempts/active', 50],
    ['/api/quiz/attempts/attempt-1/finalize-awards', 50],
  ])('keeps non-polling attempt routes on the default limit: %s', async (path, expectedLimit) => {
    const result = await checkRateLimit(
      new NextRequest(`http://localhost:3000${path}`)
    );

    expect(result.limit).toBe(expectedLimit);
  });

  it('blocks the expensive generate route after its 5-request budget', async () => {
    const url = 'http://localhost:3000/api/merchant/quiz/generate';

    for (let i = 0; i < 5; i += 1) {
      const allowed = await checkRateLimit(new NextRequest(url));
      expect(allowed.allowed).toBe(true);
    }

    const blocked = await checkRateLimit(new NextRequest(url));
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('does not apply a quiz limit to unrelated routes (default fall-through)', async () => {
    const result = await checkRateLimit(
      new NextRequest('http://localhost:3000/api/unknown')
    );

    // The four quiz limits (5/10/20) must not leak onto unmatched paths.
    expect([5, 10, 20]).not.toContain(result.limit);
  });

  it('gives IMEI status polling a separate high-frequency bucket', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/storefront/imei-check/11111111-1111-4111-8111-111111111111'
    );

    for (let index = 0; index < 120; index += 1) {
      await expect(checkImeiPollRateLimit(request)).resolves.toMatchObject({
        allowed: true,
        limit: 120,
      });
    }

    await expect(checkImeiPollRateLimit(request)).resolves.toMatchObject({
      allowed: false,
      limit: 120,
      remaining: 0,
    });
  });

  it('reports an unconfigured Redis fallback with fixed-cardinality diagnostics', async () => {
    const diagnostics: unknown[] = [];
    setRateLimitDiagnosticHook((diagnostic) => diagnostics.push(diagnostic));

    await checkRateLimit(new NextRequest('http://localhost:3000/api/unknown'));

    expect(diagnostics).toEqual([
      { backend: 'memory', reason: 'redis_unavailable' },
    ]);
  });

  it('ignores diagnostic sink failures and preserves the rate-limit result', async () => {
    setRateLimitDiagnosticHook(() => {
      throw new Error('diagnostic sink unavailable');
    });

    await expect(
      checkRateLimit(new NextRequest('http://localhost:3000/api/unknown'))
    ).resolves.toMatchObject({ allowed: true });
  });
});
