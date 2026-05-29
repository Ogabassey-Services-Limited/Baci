import { describe, expect, it } from 'vitest';
import {
  orderWalletFundingIntentCreateSchema,
  orderWalletFundingIntentPollSchema,
} from '@/schemas/order-wallet-funding-intent';

const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000101';
const VALID_MERCHANT_ID = '00000000-0000-4000-8000-000000000102';

describe('order wallet funding intent schemas', () => {
  it('parses a valid creation payload with an existing merchant slug', () => {
    const result = orderWalletFundingIntentCreateSchema.parse({
      merchantSlug: 'ogabassey',
      orderId: VALID_ORDER_ID,
    });

    expect(result).toEqual({
      merchantSlug: 'ogabassey',
      orderId: VALID_ORDER_ID,
    });
  });

  it('parses a valid creation payload with merchantId only', () => {
    expect(
      orderWalletFundingIntentCreateSchema.parse({
        merchantId: VALID_MERCHANT_ID,
        orderId: VALID_ORDER_ID,
      })
    ).toEqual({
      merchantId: VALID_MERCHANT_ID,
      orderId: VALID_ORDER_ID,
    });
  });

  it('parses explicit consent only when it is true', () => {
    const result = orderWalletFundingIntentCreateSchema.parse({
      consent: true,
      merchantId: VALID_MERCHANT_ID,
      orderId: VALID_ORDER_ID,
    });

    expect(result.consent).toBe(true);
  });

  it('rejects creation without a merchant identifier', () => {
    const result = orderWalletFundingIntentCreateSchema.safeParse({
      orderId: VALID_ORDER_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Merchant slug or id is required',
            path: ['merchantSlug'],
          }),
        ])
      );
    }
  });

  it('rejects client-supplied money fields', () => {
    const result = orderWalletFundingIntentCreateSchema.safeParse({
      amount: 20000,
      currency: 'NGN',
      expectedAmount: 20000,
      merchantSlug: 'ogabassey',
      orderId: VALID_ORDER_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'unrecognized_keys' }),
        ])
      );
    }
  });

  it('rejects invalid order ids', () => {
    const result = orderWalletFundingIntentCreateSchema.safeParse({
      merchantSlug: 'ogabassey',
      orderId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['orderId'],
          }),
        ])
      );
    }
  });

  it('rejects false consent instead of treating it as authorization', () => {
    const result = orderWalletFundingIntentCreateSchema.safeParse({
      consent: false,
      merchantSlug: 'ogabassey',
      orderId: VALID_ORDER_ID,
    });

    expect(result.success).toBe(false);
  });

  it('parses a scoped poll payload', () => {
    expect(
      orderWalletFundingIntentPollSchema.parse({
        merchantId: VALID_MERCHANT_ID,
      })
    ).toEqual({ merchantId: VALID_MERCHANT_ID });
  });

  it('rejects poll payloads without a merchant identifier', () => {
    const result = orderWalletFundingIntentPollSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Merchant slug or id is required',
            path: ['merchantSlug'],
          }),
        ])
      );
    }
  });

  it('rejects malformed poll merchant ids', () => {
    const result = orderWalletFundingIntentPollSchema.safeParse({
      merchantId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['merchantId'],
          }),
        ])
      );
    }
  });

  it('rejects empty poll merchant identifiers', () => {
    const result = orderWalletFundingIntentPollSchema.safeParse({
      merchantId: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Merchant slug or id is required',
            path: ['merchantSlug'],
          }),
        ])
      );
    }
  });

  it('rejects unknown poll payload keys', () => {
    const result = orderWalletFundingIntentPollSchema.safeParse({
      extra: true,
      merchantId: VALID_MERCHANT_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'unrecognized_keys' }),
        ])
      );
    }
  });
});
