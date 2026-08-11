import { describe, expect, it } from 'vitest';
import { reconcilePaystackUnmatchedPartialArgsSchema } from './reconcile-paystack-unmatched-partial';

describe('reconcilePaystackUnmatchedPartialArgsSchema', () => {
  it('accepts all operator identity and payment review inputs', () => {
    const result = reconcilePaystackUnmatchedPartialArgsSchema.safeParse({
      '--review-id': '11111111-1111-4111-8111-111111111111',
      '--canonical-order-id': '22222222-2222-4222-8222-222222222222',
      '--merchant-id': '33333333-3333-4333-8333-333333333333',
      '--operator-user-id': '44444444-4444-4444-8444-444444444444',
      '--paystack-reference': 'paystack-reference-1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid review identity before database access', () => {
    const result = reconcilePaystackUnmatchedPartialArgsSchema.safeParse({
      '--review-id': 'not-a-uuid',
      '--canonical-order-id': '22222222-2222-4222-8222-222222222222',
      '--merchant-id': '33333333-3333-4333-8333-333333333333',
      '--operator-user-id': '44444444-4444-4444-8444-444444444444',
      '--paystack-reference': 'paystack-reference-1',
    });

    expect(result.success).toBe(false);
  });
});
