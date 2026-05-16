import { describe, expect, it } from 'vitest';
import {
  WALLET_TOP_UP_MAX_AMOUNT,
  WALLET_TOP_UP_MIN_AMOUNT,
} from '@/lib/wallet-top-up-constants';
import {
  walletTopUpConfirmSchema,
  walletTopUpInitializeSchema,
} from '@/schemas/wallet-top-up';

describe('wallet top-up schemas', () => {
  it('parses a valid initialize payload', () => {
    const parsed = walletTopUpInitializeSchema.parse({
      amount: '2500',
      gateway: 'paystack',
      merchantSlug: 'ogabassey',
    });

    expect(parsed).toMatchObject({
      amount: 2500,
      gateway: 'paystack',
      merchantSlug: 'ogabassey',
    });
  });

  it('accepts merchant id when the native storefront slug is unavailable or stale', () => {
    const parsed = walletTopUpInitializeSchema.parse({
      amount: 2500,
      merchantId: 'merchant-1',
    });

    expect(parsed).toEqual({
      amount: 2500,
      merchantId: 'merchant-1',
    });
  });

  it('rejects initialize payloads missing merchant slug and id', () => {
    const result = walletTopUpInitializeSchema.safeParse({
      amount: 2500,
      gateway: 'paystack',
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

  it('rejects out-of-range top-up amounts', () => {
    expect(
      walletTopUpInitializeSchema.safeParse({
        amount: WALLET_TOP_UP_MIN_AMOUNT - 1,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it('accepts the minimum wallet top-up amount', () => {
    const result = walletTopUpInitializeSchema.safeParse({
      amount: WALLET_TOP_UP_MIN_AMOUNT,
      gateway: 'paystack',
      merchantSlug: 'ogabassey',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        amount: WALLET_TOP_UP_MIN_AMOUNT,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      });
    }
  });

  it('accepts the maximum wallet top-up amount', () => {
    expect(
      walletTopUpInitializeSchema.safeParse({
        amount: WALLET_TOP_UP_MAX_AMOUNT,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(true);
  });

  it('rejects top-up amounts above the maximum', () => {
    expect(
      walletTopUpInitializeSchema.safeParse({
        amount: WALLET_TOP_UP_MAX_AMOUNT + 1,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it.each([
    'not-a-number',
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid amount value %s', (amount) => {
    expect(
      walletTopUpInitializeSchema.safeParse({
        amount,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it('rejects unsupported gateway values', () => {
    expect(
      walletTopUpInitializeSchema.safeParse({
        amount: WALLET_TOP_UP_MIN_AMOUNT,
        gateway: 'unsupported',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it('rejects confirm payloads missing required references', () => {
    expect(
      walletTopUpConfirmSchema.safeParse({
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it('accepts merchant id for confirmation when the native storefront slug is unavailable or stale', () => {
    const result = walletTopUpConfirmSchema.safeParse({
      gateway: 'paystack',
      merchantId: 'merchant-1',
      reference: 'WAL-123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        gateway: 'paystack',
        merchantId: 'merchant-1',
        reference: 'WAL-123',
      });
    }
  });

  it('rejects confirm payloads missing merchant slug and id', () => {
    const result = walletTopUpConfirmSchema.safeParse({
      gateway: 'paystack',
      reference: 'WAL-123',
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

  it.each([
    { merchantSlug: '', reference: 'WAL-123' },
    { merchantSlug: '   ', reference: 'WAL-123' },
    { merchantSlug: 'ogabassey', reference: '' },
    { merchantSlug: 'ogabassey', reference: '   ' },
  ])('rejects blank confirm strings for %o', ({ merchantSlug, reference }) => {
    expect(
      walletTopUpConfirmSchema.safeParse({
        gateway: 'paystack',
        merchantSlug,
        reference,
      }).success
    ).toBe(false);
  });

  it('rejects unsupported confirm gateway values', () => {
    expect(
      walletTopUpConfirmSchema.safeParse({
        gateway: 'stripe',
        merchantSlug: 'ogabassey',
        reference: 'WAL-123',
      }).success
    ).toBe(false);
  });

  it('parses a valid confirm payload', () => {
    const result = walletTopUpConfirmSchema.safeParse({
      gateway: 'korapay',
      merchantSlug: '  ogabassey  ',
      reference: '  WAL-123  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        gateway: 'korapay',
        merchantSlug: 'ogabassey',
        reference: 'WAL-123',
      });
    }
  });
});
