import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNgnPerUsdt } from '@/lib/juicyway/rates';
import {
  getReusablePayPalOrderId,
  resolvePaypalPresentment,
  validateSameOriginUrl,
} from './paypal-create-order-helpers';

vi.mock('@/lib/juicyway/rates', () => ({
  getNgnPerUsdt: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('validateSameOriginUrl', () => {
  it('returns undefined when no url is provided', () => {
    expect(
      validateSameOriginUrl(undefined, 'https://a.example')
    ).toBeUndefined();
  });

  it('returns the normalized url when the origin matches', () => {
    expect(
      validateSameOriginUrl(
        'https://a.example/checkout?x=1',
        'https://a.example'
      )
    ).toBe('https://a.example/checkout?x=1');
  });

  it('throws on a cross-origin url', () => {
    expect(() =>
      validateSameOriginUrl('https://evil.example/steal', 'https://a.example')
    ).toThrow();
  });
});

describe('getReusablePayPalOrderId', () => {
  const metadata = {
    paypal_presentment_amount: 100,
    paypal_presentment_currency: 'USD',
  };

  it('reuses when presentment amount and currency match', () => {
    expect(
      getReusablePayPalOrderId(
        { gateway_reference: 'PP-1', metadata },
        100,
        'USD'
      )
    ).toBe('PP-1');
  });

  it('returns null when the amount moved beyond tolerance', () => {
    expect(
      getReusablePayPalOrderId(
        { gateway_reference: 'PP-1', metadata },
        105,
        'USD'
      )
    ).toBeNull();
  });

  it('returns null when the currency differs', () => {
    expect(
      getReusablePayPalOrderId(
        { gateway_reference: 'PP-1', metadata },
        100,
        'EUR'
      )
    ).toBeNull();
  });

  it('returns null when there is no gateway_reference', () => {
    expect(getReusablePayPalOrderId({ metadata }, 100, 'USD')).toBeNull();
  });
});

describe('resolvePaypalPresentment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presents a non-NGN currency as-is with fxRate 1', async () => {
    const result = await resolvePaypalPresentment('USD', 42);

    expect(result).toEqual({
      ok: true,
      presentmentAmount: 42,
      presentmentCurrency: 'USD',
      fxRate: 1,
    });
    expect(getNgnPerUsdt).not.toHaveBeenCalled();
  });

  it('converts NGN to USD at the live rate', async () => {
    vi.mocked(getNgnPerUsdt).mockResolvedValue(1300);

    const result = await resolvePaypalPresentment('NGN', 130000);

    expect(result).toEqual({
      ok: true,
      presentmentAmount: 100,
      presentmentCurrency: 'USD',
      fxRate: 1300,
    });
  });

  it('fails closed when the live rate fetch throws', async () => {
    vi.mocked(getNgnPerUsdt).mockRejectedValue(new Error('coingecko down'));

    expect(await resolvePaypalPresentment('NGN', 130000)).toEqual({
      ok: false,
    });
  });

  it('fails closed when the live rate is non-positive', async () => {
    vi.mocked(getNgnPerUsdt).mockResolvedValue(0);

    expect(await resolvePaypalPresentment('NGN', 130000)).toEqual({
      ok: false,
    });
  });
});
