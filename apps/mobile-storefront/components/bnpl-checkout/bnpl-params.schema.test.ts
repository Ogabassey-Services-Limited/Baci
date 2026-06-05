import { describe, expect, it } from '@jest/globals';
import { BNPLParamsSchema } from '@/components/bnpl-checkout/bnpl-params.schema';

describe('BNPLParamsSchema', () => {
  it('accepts valid BNPL params payload', () => {
    const result = BNPLParamsSchema.safeParse({
      amount: '250000',
      customerEmail: 'customer@example.com',
      gateway: 'credit_direct',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      trackingToken: 'tracking-token',
    });

    expect(result.success).toBe(true);
  });

  it('accepts decimal BNPL amounts from fractional tax totals', () => {
    const result = BNPLParamsSchema.safeParse({
      amount: '386284.93',
      gateway: 'credit_direct',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed BNPL amounts', () => {
    const result = BNPLParamsSchema.safeParse({
      amount: '386284.930',
      gateway: 'credit_direct',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
    });

    expect(result.success).toBe(false);
  });

  it('strips untrusted merchantDomain route params from parsed data', () => {
    const result = BNPLParamsSchema.safeParse({
      gateway: 'credit_direct',
      merchantDomain: 'evil.example',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('merchantDomain');
  });

  it('rejects invalid gateway values', () => {
    const result = BNPLParamsSchema.safeParse({
      gateway: 'paystack',
      orderId: 'order-123',
    });

    expect(result.success).toBe(false);
  });
});
