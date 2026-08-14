import { describe, expect, it } from 'vitest';
import { quizPrizeClaimProjectionSchema } from './quiz-prize-claim';

describe('quiz prize claim projection schema', () => {
  it('accepts a bounded winner projection', () => {
    expect(
      quizPrizeClaimProjectionSchema.parse({
        awardId: '11111111-1111-4111-8111-111111111111',
        condition: 'used',
        expiresAt: '2026-08-12T10:05:00.000Z',
        productId: '22222222-2222-4222-8222-222222222222',
        variantId: null,
      })
    ).toMatchObject({ condition: 'used' });
  });

  it('accepts no claim when a winning award is unavailable', () => {
    expect(quizPrizeClaimProjectionSchema.parse(null)).toBeNull();
  });

  it('rejects internal fields or invalid conditions', () => {
    expect(
      quizPrizeClaimProjectionSchema.safeParse({
        awardId: '11111111-1111-4111-8111-111111111111',
        condition: 'mystery',
        expiresAt: '2026-08-12T10:05:00.000Z',
        productId: '22222222-2222-4222-8222-222222222222',
        variantId: null,
        customerId: 'private',
      }).success
    ).toBe(false);
  });
});
