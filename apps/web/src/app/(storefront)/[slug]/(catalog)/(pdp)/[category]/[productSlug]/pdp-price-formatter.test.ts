import { describe, expect, it } from 'vitest';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { getPdpPriceFormatter } from './pdp-price-formatter';

// Non-breaking space, as emitted by Intl between an ISO-style symbol and the
// amount. Spelled out so the expectations cannot silently drift to U+0020.
const NBSP = '\u00A0';

describe('getPdpPriceFormatter', () => {
  it('formats a Nigerian merchant price with the naira symbol', () => {
    // Arrange
    const currency = resolveMerchantCurrencyConfig({
      country: 'NG',
      payout_currency: 'NGN',
    });

    // Act
    const formatted = getPdpPriceFormatter(currency).format(390_000);

    // Assert
    expect(formatted).toBe('₦390,000');
  });

  it('drops decimals on whole amounts but keeps them on fractional amounts', () => {
    // Arrange
    const currency = resolveMerchantCurrencyConfig({
      country: 'NG',
      payout_currency: 'NGN',
    });

    // Act
    const formatter = getPdpPriceFormatter(currency);

    // Assert
    expect(formatter.format(390_000)).toBe('₦390,000');
    expect(formatter.format(390_000.5)).toBe('₦390,000.5');
  });

  it('formats a Ghanaian merchant price with the cedi symbol', () => {
    // Arrange
    const currency = resolveMerchantCurrencyConfig({
      country: 'GH',
      payout_currency: 'GHS',
    });

    // Act
    const formatted = getPdpPriceFormatter(currency).format(999);

    // Assert
    expect(formatted).toBe('GH₵999');
  });

  it('reuses one cached formatter per locale/currency pair', () => {
    // Arrange
    const currency = resolveMerchantCurrencyConfig({
      country: 'KE',
      payout_currency: 'KES',
    });

    // Act
    const first = getPdpPriceFormatter(currency);
    const second = getPdpPriceFormatter({ ...currency });

    // Assert
    expect(second).toBe(first);
  });

  it('keeps separate formatters for one currency across different locales', () => {
    // Arrange
    const americanUsd = { code: 'USD', symbol: '$', locale: 'en-US' };
    const nigerianUsd = { code: 'USD', symbol: '$', locale: 'en-NG' };

    // Act
    const americanFormatter = getPdpPriceFormatter(americanUsd);
    const nigerianFormatter = getPdpPriceFormatter(nigerianUsd);

    // Assert: a cache keyed only by currency code would collide here
    expect(nigerianFormatter).not.toBe(americanFormatter);
    expect(americanFormatter.format(999)).toBe('$999');
    expect(nigerianFormatter.format(999)).toBe('US$999');
  });

  it('falls back to the platform NGN currency for merchants with no payout currency', () => {
    // Arrange
    const currency = resolveMerchantCurrencyConfig({
      country: null,
      payout_currency: null,
    });

    // Act
    const formatted = getPdpPriceFormatter(currency).format(390_000);

    // Assert
    expect(formatted).toBe('₦390,000');
  });

  it("follows the merchant's country locale when it disagrees with the payout currency", () => {
    // Arrange: `payout_currency` is NOT NULL DEFAULT 'NGN', so a merchant can
    // sit on the default while trading from another country.
    const currency = resolveMerchantCurrencyConfig({
      country: 'GH',
      payout_currency: 'NGN',
    });

    // Act
    const formatted = getPdpPriceFormatter(currency).format(390_000);

    // Assert: matches how the home feed and category listings already render
    // this merchant, rather than the PDP's old naira-locale-only output.
    expect(formatted).toBe(`NGN${NBSP}390,000`);
  });
});

describe('bugfix: PDP prices were formatted with a hardcoded en-NG locale', () => {
  it.each([
    { country: 'GH', payout_currency: 'GHS', expected: 'GH₵999' },
    { country: 'ZA', payout_currency: 'ZAR', expected: `R${NBSP}999` },
    { country: 'KE', payout_currency: 'KES', expected: `Ksh${NBSP}999` },
    { country: 'US', payout_currency: 'USD', expected: '$999' },
  ])('renders $payout_currency as $expected instead of the bare ISO code', ({
    country,
    payout_currency,
    expected,
  }) => {
    // Arrange: a non-Nigerian merchant, which previously formatted through
    // `new Intl.NumberFormat('en-NG', …)` and produced `GHS 999`-style output.
    const currency = resolveMerchantCurrencyConfig({
      country,
      payout_currency,
    });

    // Act
    const formatted = getPdpPriceFormatter(currency).format(999);

    // Assert
    expect(formatted).toBe(expected);
    expect(formatted).not.toBe(`${payout_currency}${NBSP}999`);
    expect(formatted).not.toContain('₦');
  });
});
