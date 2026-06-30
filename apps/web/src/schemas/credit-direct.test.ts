import { describe, expect, it } from 'vitest';
import {
  creditDirectWebhookProductSchema,
  creditDirectWebhookSchema,
} from '@/schemas/credit-direct';

describe('Credit Direct schemas', () => {
  const validWebhookPayload = {
    checkoutCustomer: {
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    checkoutTransactionId: 'txn_123',
    eventType: 'Checkout_Merchant_Payment_Completed',
    metaData: 'order_123',
    products: [
      {
        productName: 'Phone',
        productAmount: '30000',
        productId: 'prod_123',
      },
    ],
    timeStamp: '2026-06-30T09:00:00Z',
  } as const;

  it('parses a valid webhook payload and normalizes omitted metadata', () => {
    const result = creditDirectWebhookSchema.safeParse({
      checkoutCustomer: validWebhookPayload.checkoutCustomer,
      checkoutTransactionId: validWebhookPayload.checkoutTransactionId,
      eventType: validWebhookPayload.eventType,
      products: validWebhookPayload.products,
      timeStamp: validWebhookPayload.timeStamp,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metaData).toBe(null);
    }
  });

  it('accepts numeric and non-empty string product amounts at the webhook boundary', () => {
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: 30000,
        productId: 'prod_123',
      }).success
    ).toBe(true);
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: 'not-a-number',
        productId: 'prod_123',
      }).success
    ).toBe(true);
  });

  it('rejects missing, null, or non-array products before route processing', () => {
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: undefined,
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: null,
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: {},
      }).success
    ).toBe(false);
  });

  it('rejects malformed product objects', () => {
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: [{ productName: 'Phone', productAmount: 30000 }],
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: [
          {
            productName: '',
            productAmount: 30000,
            productId: 'prod_123',
          },
        ],
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: [
          {
            productName: 'Phone',
            productAmount: '',
            productId: 'prod_123',
          },
        ],
      }).success
    ).toBe(false);
  });
});
