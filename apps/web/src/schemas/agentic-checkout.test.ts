import { describe, expect, it } from 'vitest';
import {
  agenticCheckoutCompleteSchema,
  agenticCheckoutUpdateSchema,
  checkoutSessionSchema,
} from '@/schemas/agentic-checkout';

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
      shipping_address: {
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

describe('agenticCheckoutCompleteSchema', () => {
  it('accepts buyer identity and a human-confirmed payment token', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      completion_authorization: {
        amount: 500000,
        confirmed_at: '2026-04-28T11:59:30.000Z',
        currency: 'ngn',
        session_id: 'agentic_session_1',
        signature: 'a'.repeat(64),
        type: 'human_confirmation',
      },
      payment_data: { provider: 'paystack', token: 'confirmed-by-human' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.completion_authorization?.currency).toBe('NGN');
    }
  });

  it('accepts missing completion authorization so the route can return a consent challenge', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: { provider: 'paystack', token: 'confirmed-by-human' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects completion without a non-empty payment token', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: { provider: 'paystack', token: '   ' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported payment providers', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: { provider: 'stripe', token: 'confirmed-by-human' },
    });

    expect(result.success).toBe(false);
  });
});
