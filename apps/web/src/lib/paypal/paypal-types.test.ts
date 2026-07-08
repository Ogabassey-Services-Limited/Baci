import { describe, expect, it } from 'vitest';
import {
  PayPalCaptureResponseSchema,
  PayPalOAuthSchema,
  PayPalOrderDetailsSchema,
  PayPalOrderResponseSchema,
  PayPalRefundResponseSchema,
} from './paypal-types';

describe('PayPalOAuthSchema', () => {
  it('parses a valid OAuth token response', () => {
    const result = PayPalOAuthSchema.safeParse({
      scope: 'all',
      access_token: 'A21_mock_token',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a response missing access_token', () => {
    const result = PayPalOAuthSchema.safeParse({
      scope: 'all',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    expect(result.success).toBe(false);
  });
});

describe('PayPalOrderResponseSchema', () => {
  it('parses a valid order-creation response', () => {
    const result = PayPalOrderResponseSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'CREATED',
      links: [
        {
          href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/PP_ORDER_1',
          rel: 'self',
          method: 'GET',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a link with a non-URL href', () => {
    const result = PayPalOrderResponseSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'CREATED',
      links: [{ href: 'not-a-url', rel: 'self', method: 'GET' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('PayPalCaptureResponseSchema', () => {
  it('parses a valid capture response with links present', () => {
    const result = PayPalCaptureResponseSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'COMPLETED',
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'CAP_1',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '10.00' },
              },
            ],
          },
        },
      ],
      links: [
        {
          href: 'https://api-m.paypal.com/v2/checkout/orders/PP_ORDER_1',
          rel: 'self',
          method: 'GET',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('parses a valid capture response even when links is absent', () => {
    const result = PayPalCaptureResponseSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'COMPLETED',
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'CAP_1',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '10.00' },
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown status value', () => {
    const result = PayPalCaptureResponseSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'SOMETHING_ELSE',
      purchase_units: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('PayPalOrderDetailsSchema', () => {
  it('parses an uncaptured order (no purchase_units.payments yet)', () => {
    const result = PayPalOrderDetailsSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'APPROVED',
      purchase_units: [{}],
    });
    expect(result.success).toBe(true);
  });

  it('parses an order with no purchase_units at all', () => {
    const result = PayPalOrderDetailsSchema.safeParse({
      id: 'PP_ORDER_1',
      status: 'CREATED',
    });
    expect(result.success).toBe(true);
  });
});

describe('PayPalRefundResponseSchema', () => {
  it('parses a completed refund response', () => {
    const result = PayPalRefundResponseSchema.safeParse({
      id: 'REFUND_1',
      status: 'COMPLETED',
      amount: { currency_code: 'USD', value: '5.00' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unrecognized refund status', () => {
    const result = PayPalRefundResponseSchema.safeParse({
      id: 'REFUND_1',
      status: 'BOGUS',
    });
    expect(result.success).toBe(false);
  });
});
