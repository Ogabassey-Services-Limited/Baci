import { describe, expect, it } from 'vitest';
import { orderReceiptBankDetailsRequestSchema } from './order-receipt-bank-details';

describe('orderReceiptBankDetailsRequestSchema', () => {
  const validOrderId = '123e4567-e89b-42d3-a456-426614174000';

  it('accepts a valid order id with no token (authenticated-owner path)', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: validOrderId,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderId).toBe(validOrderId);
      expect(result.data.token).toBeUndefined();
    }
  });

  it('accepts a valid order id with a guest tracking token', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: validOrderId,
      token: 'trk_abc123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('trk_abc123');
    }
  });

  it('trims surrounding whitespace from the token', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: validOrderId,
      token: '  trk_padded  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('trk_padded');
    }
  });

  it('rejects a non-uuid order id', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing order id', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      token: 'trk_abc123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty token (whitespace-only)', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: validOrderId,
      token: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a token longer than the maximum length', () => {
    const result = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: validOrderId,
      token: 'x'.repeat(257),
    });

    expect(result.success).toBe(false);
  });
});
