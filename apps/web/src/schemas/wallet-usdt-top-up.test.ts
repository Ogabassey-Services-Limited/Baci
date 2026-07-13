import { describe, expect, it } from 'vitest';
import { walletUsdtTopUpInitializeSchema } from './wallet-usdt-top-up';

describe('walletUsdtTopUpInitializeSchema', () => {
  const valid = {
    amount: 25,
    billingAddress: {
      city: 'Lagos',
      country: 'NG',
      line1: '1 Example Street',
      zipCode: '100001',
    },
    chain: 'TRX',
    merchantSlug: 'ogabassey',
  };

  it('accepts a bounded USDT amount and supported chain', () => {
    expect(walletUsdtTopUpInitializeSchema.parse(valid)).toMatchObject(valid);
  });

  it('rejects unsupported chains and missing merchant identity', () => {
    expect(
      walletUsdtTopUpInitializeSchema.safeParse({
        ...valid,
        chain: 'BTC',
        merchantSlug: undefined,
      }).success
    ).toBe(false);
  });

  it('rejects amounts below one USDT or above the funding limit', () => {
    expect(
      walletUsdtTopUpInitializeSchema.safeParse({ ...valid, amount: 0.99 })
        .success
    ).toBe(false);
    expect(
      walletUsdtTopUpInitializeSchema.safeParse({ ...valid, amount: 10_001 })
        .success
    ).toBe(false);
  });
});
