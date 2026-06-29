import { describe, expect, it } from 'vitest';
import { receiptClaimLoginEmailQuerySchema } from '@/schemas/receipt-claim-login-email-query';

describe('receiptClaimLoginEmailQuerySchema', () => {
  it.each([
    'app',
    'unknown',
    'web',
  ] as const)('accepts %s as a login email source', (source) => {
    expect(
      receiptClaimLoginEmailQuerySchema.safeParse({ source }).success
    ).toBe(true);
  });

  it('allows the source to be omitted', () => {
    expect(receiptClaimLoginEmailQuerySchema.parse({})).toEqual({});
  });

  it('rejects unknown source values', () => {
    expect(
      receiptClaimLoginEmailQuerySchema.safeParse({ source: 'mobile' }).success
    ).toBe(false);
  });
});
