import { describe, expect, it } from 'vitest';
import {
  paypalCaptureOrderSchema,
  paypalClientTokenSchema,
  paypalCreateOrderSchema,
} from './paypal-checkout';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const UUID_2 = '123e4567-e89b-12d3-a456-426614174111';

describe('paypalCreateOrderSchema', () => {
  it('accepts a valid create-order payload with optional urls', () => {
    const result = paypalCreateOrderSchema.safeParse({
      order_id: UUID,
      customer_email: 'customer@example.com',
      merchant_id: UUID_2,
      return_url: 'https://store.example.com/checkout?paypal_return=1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid order_id', () => {
    const result = paypalCreateOrderSchema.safeParse({
      order_id: 'not-a-uuid',
      customer_email: 'customer@example.com',
      merchant_id: UUID_2,
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid customer_email', () => {
    const result = paypalCreateOrderSchema.safeParse({
      order_id: UUID,
      customer_email: 'not-an-email',
      merchant_id: UUID_2,
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-url return_url', () => {
    const result = paypalCreateOrderSchema.safeParse({
      order_id: UUID,
      customer_email: 'customer@example.com',
      merchant_id: UUID_2,
      return_url: 'not a url',
    });

    expect(result.success).toBe(false);
  });
});

describe('paypalCaptureOrderSchema', () => {
  it('accepts a valid capture payload', () => {
    const result = paypalCaptureOrderSchema.safeParse({
      order_id: UUID,
      paypal_order_id: 'PAYPAL-ORD-123',
      customer_email: 'customer@example.com',
      merchant_id: UUID_2,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty paypal_order_id', () => {
    const result = paypalCaptureOrderSchema.safeParse({
      order_id: UUID,
      paypal_order_id: '',
      customer_email: 'customer@example.com',
      merchant_id: UUID_2,
    });

    expect(result.success).toBe(false);
  });
});

describe('paypalClientTokenSchema', () => {
  it('accepts a valid merchant_id', () => {
    expect(
      paypalClientTokenSchema.safeParse({ merchant_id: UUID }).success
    ).toBe(true);
  });

  it('rejects a missing merchant_id', () => {
    expect(paypalClientTokenSchema.safeParse({}).success).toBe(false);
  });
});
