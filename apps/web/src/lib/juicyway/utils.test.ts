import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  JUICYWAY_BASE_URL: 'https://sandbox.spendjuice.com',
  JUICYWAY_SECRET_KEY: 'sk_test_key',
}));

import {
  formatPhoneToE164,
  generatePaymentReference,
  getChainConfirmationTime,
  getJuicywayMode,
  isJuicywayConfigured,
  isSupportedCurrency,
} from './utils';

describe('getChainConfirmationTime', () => {
  it('returns correct time for TRX', () => {
    expect(getChainConfirmationTime('TRX')).toBe('1-3 minutes');
  });

  it('returns correct time for ETH', () => {
    expect(getChainConfirmationTime('ETH')).toBe('5-30 minutes');
  });

  it('returns correct time for MATIC', () => {
    expect(getChainConfirmationTime('MATIC')).toBe('1-5 minutes');
  });

  it('returns correct time for AVAXC', () => {
    expect(getChainConfirmationTime('AVAXC')).toBe('1-5 minutes');
  });
});

describe('generatePaymentReference', () => {
  it('starts with default prefix', () => {
    const ref = generatePaymentReference();
    expect(ref).toMatch(/^baci_/);
  });

  it('uses custom prefix when provided', () => {
    const ref = generatePaymentReference('order');
    expect(ref).toMatch(/^order_/);
  });

  it('is max 50 characters', () => {
    const ref = generatePaymentReference();
    expect(ref.length).toBeLessThanOrEqual(50);
  });

  it('generates unique references', () => {
    const refs = new Set(
      Array.from({ length: 20 }, () => generatePaymentReference())
    );
    expect(refs.size).toBe(20);
  });
});

describe('formatPhoneToE164', () => {
  it('formats local number starting with 0', () => {
    expect(formatPhoneToE164('08012345678')).toBe('+2348012345678');
  });

  it('formats number without leading 0', () => {
    expect(formatPhoneToE164('8012345678')).toBe('+2348012345678');
  });

  it('returns already-prefixed 234 number with +', () => {
    expect(formatPhoneToE164('2348012345678')).toBe('+2348012345678');
  });

  it('uses custom country code', () => {
    expect(formatPhoneToE164('7012345678', '+1')).toBe('+17012345678');
  });

  it('strips non-digit characters', () => {
    expect(formatPhoneToE164('080-1234-5678')).toBe('+2348012345678');
  });

  it('returns empty string for empty input', () => {
    expect(formatPhoneToE164('')).toBe('');
  });

  it('returns empty string for non-digit input after stripping', () => {
    expect(formatPhoneToE164('---')).toBe('');
  });
});

describe('isJuicywayConfigured', () => {
  it('returns true when secret key is set', () => {
    expect(isJuicywayConfigured()).toBe(true);
  });

  it('returns false when secret key is empty', async () => {
    vi.resetModules();
    vi.doMock('./client', () => ({
      JUICYWAY_BASE_URL: 'https://sandbox.spendjuice.com',
      JUICYWAY_SECRET_KEY: '',
    }));
    const { isJuicywayConfigured: fn } = await import('./utils');
    expect(fn()).toBe(false);
  });
});

describe('getJuicywayMode', () => {
  it('returns sandbox when URL contains sandbox', () => {
    expect(getJuicywayMode()).toBe('sandbox');
  });

  it('returns live for production URL', async () => {
    vi.resetModules();
    vi.doMock('./client', () => ({
      JUICYWAY_BASE_URL: 'https://api.spendjuice.com',
      JUICYWAY_SECRET_KEY: 'sk_live_key',
    }));
    const { getJuicywayMode: fn } = await import('./utils');
    expect(fn()).toBe('live');
  });
});

describe('isSupportedCurrency', () => {
  it('returns true for NGN', () => {
    expect(isSupportedCurrency('NGN')).toBe(true);
  });

  it('returns true for USDT', () => {
    expect(isSupportedCurrency('USDT')).toBe(true);
  });

  it('returns true for USDC', () => {
    expect(isSupportedCurrency('USDC')).toBe(true);
  });

  it('returns false for unsupported currency', () => {
    expect(isSupportedCurrency('GBP')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSupportedCurrency('')).toBe(false);
  });
});
