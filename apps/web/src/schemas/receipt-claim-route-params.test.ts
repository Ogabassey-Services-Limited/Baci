import { describe, expect, it } from 'vitest';
import { receiptClaimRouteParamsSchema } from '@/schemas/receipt-claim-route-params';

describe('receiptClaimRouteParamsSchema', () => {
  it.each([
    'claim-token_1',
    'abcdefgh',
    'a'.repeat(256),
  ])('accepts %s as a receipt claim token', (token) => {
    const result = receiptClaimRouteParamsSchema.safeParse({ token });

    expect(result.success).toBe(true);
    expect(result.data?.token).toBe(token);
  });

  it('trims receipt claim tokens', () => {
    const result = receiptClaimRouteParamsSchema.safeParse({
      token: '  claim-token_1  ',
    });

    expect(result.success).toBe(true);
    expect(result.data?.token).toBe('claim-token_1');
  });

  it.each([
    ['empty', ''],
    ['too short', 'short'],
    ['too long', 'a'.repeat(257)],
    ['spaces', 'claim token'],
    ['path traversal', '../claim-token'],
  ])('rejects %s tokens', (_label, token) => {
    const result = receiptClaimRouteParamsSchema.safeParse({ token });

    expect(result.success).toBe(false);
  });
});
