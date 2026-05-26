import { describe, expect, it } from 'vitest';
import {
  walletFundingAccountConsentSchema,
  walletFundingAccountQuerySchema,
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
