import { describe, expect, it } from 'vitest';
import {
  agenticCheckoutCompleteSchema,
  agenticCheckoutUpdateSchema,
  checkoutSessionSchema,
  createAgenticCheckoutSessionInputSchema,
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

describe('createAgenticCheckoutSessionInputSchema', () => {
  it('accepts an MCP checkout session payload with an idempotency key', () => {
    const result = createAgenticCheckoutSessionInputSchema.safeParse({
      currency: 'ngn',
      idempotency_key: 'idem-checkout-1',
      items: [{ id: 'product-1', quantity: 2 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('NGN');
      expect(result.data.idempotency_key).toBe('idem-checkout-1');
    }
  });

  it('rejects item quantities above the MCP checkout limit', () => {
    const result = createAgenticCheckoutSessionInputSchema.safeParse({
      idempotency_key: 'idem-checkout-1',
      items: [{ id: 'product-1', quantity: 21 }],
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

  it('accepts pay on delivery without a payment token', () => {
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
      payment_data: { provider: 'pay_on_delivery' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payment_data.provider).toBe('pay_on_delivery');
    }
  });

  it('rejects pay on delivery with an unexpected payment token', () => {
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
      payment_data: {
        provider: 'pay_on_delivery',
        token: 'unexpected-token',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects Paystack payment data with unexpected fields', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: {
        provider: 'paystack',
        token: 'confirmed-by-human',
        unexpected: true,
      },
    });

    expect(result.success).toBe(false);
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

  it('accepts paystack_bank_transfer as a Paystack provider alias', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: {
        provider: 'paystack_bank_transfer',
        token: 'manifest-advertised-token',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payment_data.provider).toBe('paystack');
      if (result.data.payment_data.provider === 'paystack') {
        expect(result.data.payment_data.token).toBe(
          'manifest-advertised-token'
        );
      }
    }
  });

  it('still accepts paystack as the canonical provider name', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: {
        provider: 'paystack',
        token: 'canonical-provider-token',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payment_data.provider).toBe('paystack');
    }
  });

  it('still rejects unexpected providers', () => {
    const result = agenticCheckoutCompleteSchema.safeParse({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      payment_data: {
        provider: 'paystack_card',
        token: 'invalid-provider-token',
      },
    });

    expect(result.success).toBe(false);
  });
});
