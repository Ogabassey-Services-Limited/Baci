import { describe, expect, it } from 'vitest';
import {
  ucpCartCreateRequestSchema,
  ucpCartUpdateRequestSchema,
} from './ucp-cart-request';

describe('ucp cart request schemas', () => {
  it('accepts a valid cart create request', () => {
    const parsed = ucpCartCreateRequestSchema.parse({
      buyer: { email: 'buyer@example.com' },
      currency: 'ngn',
      line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
    });

    expect(parsed.currency).toBe('NGN');
    expect(parsed.line_items).toHaveLength(1);
  });

  it('rejects empty cart line items', () => {
    const parsed = ucpCartCreateRequestSchema.safeParse({ line_items: [] });

    expect(parsed.success).toBe(false);
  });

  it('accepts cart update with fulfillment context', () => {
    const parsed = ucpCartUpdateRequestSchema.parse({
      line_items: [{ item: { id: 'product-1' }, quantity: 1 }],
      shipping_address: {
        address_country: 'NG',
        address_locality: 'Lagos',
        street_address: '1 Baci Road',
      },
    });

    expect(parsed.shipping_address?.address_country).toBe('NG');
  });
});
