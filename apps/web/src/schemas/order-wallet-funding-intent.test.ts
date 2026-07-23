import { describe, expect, it } from 'vitest';
import {
  ambiguousReviewSchema,
  orderWalletFundingIntentCreateSchema,
  orderWalletFundingIntentPollSchema,
  walletOrderFundingIntentCreateResponseSchema,
  walletOrderFundingIntentPollResponseSchema,
} from '@/schemas/order-wallet-funding-intent';
import {
  INTENT,
  VALID_MERCHANT_ID,
  VALID_ORDER_ID,
} from './order-wallet-funding-intent.fixtures';

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

  it('parses a valid ambiguous review payload', () => {
    expect(
      ambiguousReviewSchema.parse({
        gatewayReference: 'PSK_REF_123',
        intentIds: ['intent-1', 'intent-2'],
      })
    ).toEqual({
      gatewayReference: 'PSK_REF_123',
      intentIds: ['intent-1', 'intent-2'],
    });
  });

  it.each([
    [
      'empty gateway reference',
      { gatewayReference: '', intentIds: ['intent-1'] },
    ],
    [
      'empty intent id list',
      { gatewayReference: 'PSK_REF_123', intentIds: [] },
    ],
    [
      'blank intent id entry',
      { gatewayReference: 'PSK_REF_123', intentIds: ['intent-1', ''] },
    ],
  ])('rejects ambiguous review payloads with %s', (_case, payload) => {
    expect(ambiguousReviewSchema.safeParse(payload).success).toBe(false);
  });
});

describe('wallet order funding intent RESPONSE schemas', () => {
  it('parses a create response and upper-cases the currency', () => {
    const parsed = walletOrderFundingIntentCreateResponseSchema.parse({
      account: {
        accountName: 'Ada Buyer',
        accountNumber: '1234567890',
        bankName: 'Wema Bank',
        provider: 'paystack',
      },
      intent: INTENT,
    });

    expect(parsed.intent.currency).toBe('NGN');
    expect(parsed.account.accountNumber).toBe('1234567890');
  });

  it('parses every status the poll route can return', () => {
    for (const status of [
      'pending',
      'underfunded',
      'funded',
      'processing',
      'completed',
      'expired',
      'cancelled',
      'review_required',
      'failed',
    ]) {
      expect(
        walletOrderFundingIntentPollResponseSchema.safeParse({
          intent: { ...INTENT, status },
        }).success
      ).toBe(true);
    }
  });

  it('carries the poll-only payment fields', () => {
    const parsed = walletOrderFundingIntentPollResponseSchema.parse({
      intent: {
        ...INTENT,
        debitedAmount: 5000,
        excessAmount: 0,
        fundedAmount: 5000,
        orderPaid: true,
        remainingAmount: 0,
        status: 'completed',
      },
    });

    expect(parsed.intent.orderPaid).toBe(true);
    expect(parsed.intent.remainingAmount).toBe(0);
  });

  it('rejects an unknown status rather than treating it as pending', () => {
    expect(
      walletOrderFundingIntentPollResponseSchema.safeParse({
        intent: { ...INTENT, status: 'settled' },
      }).success
    ).toBe(false);
  });

  it('rejects a non-positive expected amount', () => {
    expect(
      walletOrderFundingIntentPollResponseSchema.safeParse({
        intent: { ...INTENT, expectedAmount: 0 },
      }).success
    ).toBe(false);
  });

  // Regression: PostgREST serializes `timestamptz` as `+00:00` offset form, not
  // bare `Z`. The parser previously used `z.iso.datetime()` (Z-only), so every
  // real create/poll response failed and the wallet flow fell back to the
  // legacy DVA. It must accept the offset form the server actually sends.
  it('accepts an offset-form (+00:00) expiration timestamp from PostgREST', () => {
    const parsed = walletOrderFundingIntentPollResponseSchema.safeParse({
      intent: { ...INTENT, expiresAt: '2026-07-13T10:30:00.000+00:00' },
    });

    expect(parsed.success).toBe(true);
  });
});
