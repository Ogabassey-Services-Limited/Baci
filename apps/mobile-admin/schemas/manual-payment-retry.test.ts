import { describe, expect, it } from 'vitest';
import { manualPaymentRetrySchema } from './manual-payment-retry';

describe('manualPaymentRetrySchema', () => {
  it('accepts a persisted payment fingerprint and UUID key', () => {
    const result = manualPaymentRetrySchema.safeParse({
      fingerprint: '{"orderId":"order-1"}',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('pending');
  });

  it('accepts a completed retry marker', () => {
    expect(
      manualPaymentRetrySchema.safeParse({
        fingerprint: '{"orderId":"order-1"}',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        status: 'completed',
      }).success
    ).toBe(true);
  });

  it('rejects an empty fingerprint', () => {
    expect(
      manualPaymentRetrySchema.safeParse({
        fingerprint: '',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }).success
    ).toBe(false);
  });

  it('rejects a malformed idempotency key', () => {
    expect(
      manualPaymentRetrySchema.safeParse({
        fingerprint: '{"orderId":"order-1"}',
        idempotencyKey: 'not-a-uuid',
      }).success
    ).toBe(false);
  });

});
