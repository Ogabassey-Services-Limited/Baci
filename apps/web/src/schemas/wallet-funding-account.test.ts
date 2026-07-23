import { describe, expect, it } from 'vitest';
import {
  walletFundingAccountConsentSchema,
  walletFundingAccountQuerySchema,
  walletFundingAccountSchema,
} from '@/schemas/wallet-funding-account';

describe('wallet funding account schemas', () => {
  it('accepts a merchant slug query', () => {
    expect(
      walletFundingAccountQuerySchema.parse({
        merchantSlug: 'ogabassey',
      })
    ).toEqual({ merchantSlug: 'ogabassey' });
  });

  it('trims merchant slug query values', () => {
    expect(
      walletFundingAccountQuerySchema.parse({
        merchantSlug: '  ogabassey  ',
      })
    ).toEqual({ merchantSlug: 'ogabassey' });
  });

  it('accepts a merchant id query', () => {
    expect(
      walletFundingAccountQuerySchema.parse({
        merchantId: '11111111-1111-4111-8111-111111111111',
      })
    ).toEqual({ merchantId: '11111111-1111-4111-8111-111111111111' });
  });

  it('rejects requests without a merchant identifier', () => {
    expect(() => walletFundingAccountQuerySchema.parse({})).toThrow();
  });

  it('rejects an invalid merchant id query', () => {
    expect(() =>
      walletFundingAccountQuerySchema.parse({
        merchantId: 'not-a-uuid',
      })
    ).toThrow();
  });

  it('rejects whitespace-only merchant slug values', () => {
    expect(() =>
      walletFundingAccountQuerySchema.parse({
        merchantSlug: '   ',
      })
    ).toThrow();
  });

  it('requires explicit customer consent for DVA creation', () => {
    expect(
      walletFundingAccountConsentSchema.parse({
        consent: true,
        merchantSlug: 'ogabassey',
      })
    ).toEqual({ consent: true, merchantSlug: 'ogabassey' });

    expect(() =>
      walletFundingAccountConsentSchema.parse({
        consent: false,
        merchantSlug: 'ogabassey',
      })
    ).toThrow();
  });

  it('requires a merchant identifier when consent is provided', () => {
    expect(() =>
      walletFundingAccountConsentSchema.parse({ consent: true })
    ).toThrow();
  });
});

describe('walletFundingAccountSchema (response)', () => {
  it('parses a funding account returned by the API', () => {
    expect(
      walletFundingAccountSchema.parse({
        accountName: 'Ada Buyer',
        accountNumber: '1234567890',
        bankName: 'Wema Bank',
        provider: 'paystack',
      })
    ).toEqual({
      accountName: 'Ada Buyer',
      accountNumber: '1234567890',
      bankName: 'Wema Bank',
      provider: 'paystack',
    });
  });

  it('tolerates the nullable account/bank names the gateway can omit', () => {
    const parsed = walletFundingAccountSchema.parse({
      accountName: null,
      accountNumber: '1234567890',
      bankName: null,
      provider: 'paystack',
    });

    expect(parsed.accountName).toBeNull();
    expect(parsed.bankName).toBeNull();
  });

  it('rejects a non-numeric account number', () => {
    expect(
      walletFundingAccountSchema.safeParse({
        accountName: 'Ada Buyer',
        accountNumber: '12AB567890',
        bankName: 'Wema Bank',
        provider: 'paystack',
      }).success
    ).toBe(false);
  });

  it('rejects an unsupported provider', () => {
    expect(
      walletFundingAccountSchema.safeParse({
        accountName: 'Ada Buyer',
        accountNumber: '1234567890',
        bankName: 'Wema Bank',
        provider: 'korapay',
      }).success
    ).toBe(false);
  });
});
