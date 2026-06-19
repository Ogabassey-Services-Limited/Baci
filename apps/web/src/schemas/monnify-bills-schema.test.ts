import { describe, expect, it } from 'vitest';
import { vendRequestSchema } from './monnify-bills-schema';

describe('vendRequestSchema', () => {
  const basePayload = {
    amount: 100,
    customerId: '08012345678',
    productCode: '13',
    vendAmount: 100,
    vendReference: 'BACI-REF-123',
  };

  it('accepts a vend payload with live amount and documented vendAmount fields', () => {
    expect(vendRequestSchema.safeParse(basePayload).success).toBe(true);
  });

  it('requires the live amount field before calling Monnify', () => {
    const result = vendRequestSchema.safeParse({
      ...basePayload,
      amount: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['amount']);
  });

  it('rejects non-positive live amounts', () => {
    const result = vendRequestSchema.safeParse({
      ...basePayload,
      amount: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Vend amount must be positive'
    );
  });
});
