import { describe, expect, it } from 'vitest';
import {
  ucpCheckoutCreateRequestSchema,
  ucpCheckoutUpdateRequestSchema,
} from '@/schemas/ucp-checkout-request';

describe('ucpCheckoutCreateRequestSchema', () => {
  it('accepts UCP checkout line items and normalizes currency', () => {
    const parsed = ucpCheckoutCreateRequestSchema.parse({
      currency: 'ngn',
      line_items: [
        {
          item: { id: 'product-1', price: 500_000, title: 'Phone' },
          quantity: 2,
        },
      ],
    });

    expect(parsed).toMatchObject({
      currency: 'NGN',
      line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
    });
  });

  it('rejects missing UCP line items', () => {
    const parsed = ucpCheckoutCreateRequestSchema.safeParse({});

    expect(parsed.success).toBe(false);
  });

  it('rejects non-letter currency codes', () => {
    const parsed = ucpCheckoutCreateRequestSchema.safeParse({
      currency: 'n1n',
      line_items: [
        {
          item: { id: 'product-1' },
          quantity: 1,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe('ucpCheckoutUpdateRequestSchema', () => {
  it('accepts replacement line items and explicit address clearing', () => {
    const parsed = ucpCheckoutUpdateRequestSchema.parse({
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: null,
    });

    expect(parsed).toMatchObject({
      line_items: [{ item: { id: 'product-2' }, quantity: 1 }],
      shipping_address: null,
    });
  });

  it('rejects updates without replacement line items', () => {
    const parsed = ucpCheckoutUpdateRequestSchema.safeParse({
      shipping_address: { city: 'Lagos' },
    });

    expect(parsed.success).toBe(false);
  });
});
