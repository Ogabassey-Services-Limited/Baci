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

  it('accepts the PascalCase payload Credit Direct sends and normalizes it', () => {
    const result = creditDirectWebhookSchema.safeParse({
      CheckoutCustomer: {
        FirstName: 'DIALA',
        LastName: 'KINGSLEY',
      },
      CheckoutTransactionId: 'a93343b8-2002-45ba-a0a5-a222e1c1d288',
      EventType: 'Checkout_Merchant_Payment_Completed',
      Products: [
        {
          ProductAmount: '430000',
          ProductId: 'CTjKsQ0uoT1782138407475-631256',
          ProductName: '13" Macbook Air 2018',
        },
      ],
      TimeStamp: '2026-07-10T16:03:38.8373464+01:00',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        checkoutCustomer: {
          firstName: 'DIALA',
          lastName: 'KINGSLEY',
        },
        checkoutTransactionId: 'a93343b8-2002-45ba-a0a5-a222e1c1d288',
        eventType: 'Checkout_Merchant_Payment_Completed',
        metaData: null,
        products: [
          {
            productAmount: 430000,
            productId: 'CTjKsQ0uoT1782138407475-631256',
            productName: '13" Macbook Air 2018',
          },
        ],
        timeStamp: '2026-07-10T16:03:38.8373464+01:00',
      });
    }
  });

  it('rejects mixed casing instead of guessing between payload formats', () => {
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        CheckoutTransactionId: 'different-transaction',
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        checkoutCustomer: {
          ...validWebhookPayload.checkoutCustomer,
          FirstName: 'DIFFERENT',
        },
      }).success
    ).toBe(false);
  });

  it('rejects malformed PascalCase events and products', () => {
    const pascalCasePayload = {
      CheckoutCustomer: {
        FirstName: 'Ada',
        LastName: 'Lovelace',
      },
      CheckoutTransactionId: 'txn_123',
      EventType: 'Checkout_Merchant_Payment_Completed',
      Products: [
        {
          ProductName: 'Phone',
          ProductAmount: '30000',
          ProductId: 'prod_123',
        },
      ],
      TimeStamp: '2026-07-10T16:03:38.8373464+01:00',
    };

    expect(
      creditDirectWebhookSchema.safeParse({
        ...pascalCasePayload,
        EventType: 'Payment_Succeeded',
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookSchema.safeParse({
        ...pascalCasePayload,
        Products: [{ ProductName: 'Phone', ProductAmount: '30000' }],
      }).success
    ).toBe(false);
  });

  it('accepts positive numeric product amounts at the webhook boundary', () => {
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: 30000,
        productId: 'prod_123',
      }).success
    ).toBe(true);
    const stringAmountResult = creditDirectWebhookProductSchema.safeParse({
      productName: 'Phone',
      productAmount: '30000',
      productId: 'prod_123',
    });

    expect(stringAmountResult.success).toBe(true);
    if (stringAmountResult.success) {
      expect(stringAmountResult.data.productAmount).toBe(30000);
    }
  });

  it('rejects invalid product amounts at the webhook boundary', () => {
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: 100.123,
        productId: 'prod_123',
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: 'not-a-number',
        productId: 'prod_123',
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: '0',
        productId: 'prod_123',
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: '-100',
        productId: 'prod_123',
      }).success
    ).toBe(false);
    expect(
      creditDirectWebhookProductSchema.safeParse({
        productName: 'Phone',
        productAmount: '100.123',
        productId: 'prod_123',
      }).success
    ).toBe(false);
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
    expect(
      creditDirectWebhookSchema.safeParse({
        ...validWebhookPayload,
        products: [],
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
