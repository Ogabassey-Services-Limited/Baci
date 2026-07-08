import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetRateLimitStoreForTesting, checkRateLimit } from './rate-limit';

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
});
