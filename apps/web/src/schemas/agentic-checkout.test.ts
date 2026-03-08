import { describe, expect, it } from 'vitest';
import {
  agenticCheckoutUpdateSchema,
  checkoutSessionSchema,
} from './agentic-checkout';

describe('checkoutSessionSchema', () => {
  it('accepts a valid checkout session payload', () => {
    const result = checkoutSessionSchema.safeParse({
      items: [{ id: 'product-1', quantity: 2 }],
      currency: 'ngn',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('NGN');
    }
  });

  it('rejects an empty items array', () => {
    const result = checkoutSessionSchema.safeParse({
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid item quantities', () => {
    const result = checkoutSessionSchema.safeParse({
      items: [{ id: 'product-1', quantity: 0 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only item identifiers', () => {
    const result = checkoutSessionSchema.safeParse({
      items: [{ id: '   ', quantity: 1 }],
    });

    expect(result.success).toBe(false);
  });
});

describe('agenticCheckoutUpdateSchema', () => {
  it('accepts a valid update payload', () => {
    const result = agenticCheckoutUpdateSchema.safeParse({
      fulfillment_option_id: 'shipping_standard',
      fulfillment_address: {
        address: '12 Example Street',
        city: 'Lagos',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty update payloads', () => {
    const result = agenticCheckoutUpdateSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only fulfillment option identifiers', () => {
    const result = agenticCheckoutUpdateSchema.safeParse({
      fulfillment_option_id: '   ',
    });

    expect(result.success).toBe(false);
  });
});
