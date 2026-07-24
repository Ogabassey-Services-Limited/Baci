import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  calculatePlatformFee as creditDirectFee,
  calculateMerchantAmount as creditDirectMerchant,
} from '../credit-direct';
import { calculatePlatformFee as korapayFee } from '../korapay';
import { calculatePlatformFee as paystackFee } from '../paystack';
import { calculatePlatformFee, resolveCapInAmountUnit } from './platform-fee';
import {
  creditDirectFeeOracle,
  creditDirectMerchantOracle,
  KOBO_AMOUNTS,
  korapayOracle,
  NAIRA_AMOUNTS,
  paystackOracle,
} from './platform-fee.test-support';

describe('calculatePlatformFee — Korapay parity (NGN, major, cents)', () => {
  beforeEach(() => {
    delete process.env.PLATFORM_FEE_PERCENTAGE;
  });

  it.each(
    NAIRA_AMOUNTS
  )('matches the legacy Korapay result for amount %d', (amount) => {
    // Arrange
    const expected = korapayOracle(amount);
    // Act
    const shared = calculatePlatformFee(amount, {
      currency: 'NGN',
      unit: 'major',
      rounding: 'cents',
      honorEnvPercentageOverride: true,
    });
    // Assert
    expect(shared).toEqual(expected);
    expect(korapayFee(amount)).toEqual(expected);
  });
});

describe('calculatePlatformFee — Paystack parity (NGN, minor, integer)', () => {
  it.each(
    KOBO_AMOUNTS
  )('matches the legacy Paystack result for %d kobo', (amountInKobo) => {
    // Arrange
    const expected = paystackOracle(amountInKobo);
    // Act
    const shared = calculatePlatformFee(amountInKobo, {
      currency: 'NGN',
      unit: 'minor',
      rounding: 'integer',
    });
    // Assert
    expect(shared).toEqual(expected);
    expect(paystackFee(amountInKobo)).toEqual(expected);
  });
});

describe('calculatePlatformFee — Credit Direct parity (NGN, major, none)', () => {
  it.each(
    NAIRA_AMOUNTS
  )('matches the legacy Credit Direct fee/merchant for amount %d', (amount) => {
    // Arrange
    const expectedFee = creditDirectFeeOracle(amount);
    const expectedMerchant = creditDirectMerchantOracle(amount);
    // Act
    const shared = calculatePlatformFee(amount, {
      currency: 'NGN',
      unit: 'major',
      rounding: 'none',
    });
    // Assert — bit-for-bit; Credit Direct never rounded its fee.
    expect(shared.platformFee).toBe(expectedFee);
    expect(shared.merchantAmount).toBe(expectedMerchant);
    expect(creditDirectFee(amount)).toBe(expectedFee);
    expect(creditDirectMerchant(amount)).toBe(expectedMerchant);
  });
});

describe('PLATFORM_FEE_PERCENTAGE env override divergence', () => {
  afterEach(() => {
    delete process.env.PLATFORM_FEE_PERCENTAGE;
  });

  it('applies the override only for Korapay (honorEnvPercentageOverride)', () => {
    // Arrange
    process.env.PLATFORM_FEE_PERCENTAGE = '5';
    // Act
    const result = calculatePlatformFee(1000, {
      currency: 'NGN',
      unit: 'major',
      rounding: 'cents',
      honorEnvPercentageOverride: true,
    });
    // Assert — 5% of 1000, and the wrapper agrees with the env-aware oracle.
    expect(result.platformFee).toBe(50);
    expect(korapayFee(1000)).toEqual(korapayOracle(1000));
  });

  it('ignores the override for Paystack (fixed 2%)', () => {
    // Arrange
    process.env.PLATFORM_FEE_PERCENTAGE = '50';
    // Act
    const shared = calculatePlatformFee(100000, {
      currency: 'NGN',
      unit: 'minor',
      rounding: 'integer',
    });
    // Assert — still 2% (2000 kobo), env-independent.
    expect(shared.platformFee).toBe(2000);
    expect(paystackFee(100000)).toEqual(paystackOracle(100000));
  });

  it('ignores the override for Credit Direct (fixed 2%)', () => {
    // Arrange
    process.env.PLATFORM_FEE_PERCENTAGE = '50';
    // Act
    const shared = calculatePlatformFee(1000, {
      currency: 'NGN',
      unit: 'major',
      rounding: 'none',
    });
    // Assert — still 2% (20), env-independent.
    expect(shared.platformFee).toBe(20);
    expect(creditDirectFee(1000)).toBe(20);
  });
});

describe('non-NGN currencies are percentage-only (no cap)', () => {
  it('applies the percentage without the NGN cap for a large USD amount', () => {
    // Arrange
    const amount = 1_000_000;
    // Act
    const usd = calculatePlatformFee(amount, {
      currency: 'USD',
      unit: 'major',
      rounding: 'cents',
    });
    const ngn = calculatePlatformFee(amount, {
      currency: 'NGN',
      unit: 'major',
      rounding: 'cents',
    });
    // Assert — USD uncapped (2% = 20,000); NGN capped at 2,050.
    expect(usd.platformFee).toBe(20000);
    expect(ngn.platformFee).toBe(2050);
  });

  it('treats unknown/other currencies as uncapped and is case-insensitive', () => {
    // Act
    const kes = calculatePlatformFee(1_000_000, {
      currency: 'KES',
      rounding: 'cents',
    });
    const lowerUsd = calculatePlatformFee(1000, {
      currency: 'usd',
      rounding: 'cents',
    });
    // Assert
    expect(kes.platformFee).toBe(20000);
    expect(lowerUsd.platformFee).toBe(20);
  });
});

describe('default options', () => {
  it('defaults to NGN cents rounding with no env override', () => {
    // Act
    const result = calculatePlatformFee(1000, { currency: 'NGN' });
    // Assert
    expect(result).toEqual({
      platformFee: 20,
      merchantAmount: 980,
      total: 1000,
    });
  });
});

describe('Korapay fee currency (Codex #39)', () => {
  it('does NOT apply the NGN ₦2,050 cap to a KES charge', () => {
    // Korapay settles KES/GHS/ZAR/XAF/XOF, and the initialize route charges in the
    // order's currency — but the fee helper hardcoded NGN, so the naira cap was
    // applied as a bare 2050 in the foreign currency. On a KES 500,000 order the
    // platform accrued KES 2,050 instead of KES 10,000 and silently ate the rest.
    const kes = korapayFee(500_000, 'KES');

    expect(kes.platformFee).toBe(10_000); // 2%, uncapped
    expect(kes.merchantAmount).toBe(490_000);
  });

  it('still caps NGN at ₦2,050 — the historical behaviour is unchanged', () => {
    const ngn = korapayFee(500_000, 'NGN');

    expect(ngn.platformFee).toBe(2_050);
    expect(ngn.merchantAmount).toBe(497_950);
  });

  it.each([
    ['GHS', 500_000, 10_000],
    ['ZAR', 500_000, 10_000],
  ])('charges 2%% uncapped for %s (2-decimal Lane-0 currency)', (currency, amount, expectedFee) => {
    const r = korapayFee(amount, currency as 'GHS');
    expect(r.platformFee).toBe(expectedFee);
    expect(r.merchantAmount).toBe(amount - expectedFee);
  });

  it.each([
    ['XAF', 5_000_000, 100_000],
    ['XOF', 5_000_000, 100_000],
  ])('charges 2%% uncapped for %s (zero-decimal CFA currency) — no ₦2,050 cap', (currency, amount, expectedFee) => {
    const r = korapayFee(amount, currency as 'XAF');
    expect(r.platformFee).toBe(expectedFee);
    expect(r.merchantAmount).toBe(amount - expectedFee);
  });

  it.each([
    ['XAF', 500_001, 10_000, 490_001],
    ['XOF', 500_001, 10_000, 490_001],
  ])('rounds %s fees to whole units for non-50-divisible amounts (Codex #P1)', (currency, amount, expectedFee, expectedMerchant) => {
    // XAF/XOF are zero-decimal: (500_001 * 2) / 100 = 10_000.02 must NOT persist
    // a fractional fee. Round to whole units, and fee + merchant === total exactly.
    const r = korapayFee(amount, currency as 'XAF');
    expect(Number.isInteger(r.platformFee)).toBe(true);
    expect(Number.isInteger(r.merchantAmount)).toBe(true);
    expect(r.platformFee).toBe(expectedFee);
    expect(r.merchantAmount).toBe(expectedMerchant);
    expect(r.platformFee + r.merchantAmount).toBe(amount);
  });

  it('does NOT round 2-decimal currencies (ZAR keeps cents)', () => {
    // Guard: the zero-decimal rounding must not leak into 2-decimal currencies.
    const r = korapayFee(500_001, 'ZAR');
    expect(r.platformFee).toBe(10_000.02);
    expect(r.merchantAmount).toBe(490_000.98);
  });

  it('defaults to NGN when no currency is supplied (back-compat)', () => {
    expect(korapayFee(500_000)).toEqual(korapayFee(500_000, 'NGN'));
  });
});

describe('resolveCapInAmountUnit (zero-decimal cap guard, CodeRabbit)', () => {
  it('scales a 2-decimal cap to minor units', () => {
    // NGN ₦2,050 cap → 205,000 kobo when the amount is in minor units.
    expect(resolveCapInAmountUnit(2050, 'minor', 'NGN')).toBe(205_000);
    expect(resolveCapInAmountUnit(2050, 'major', 'NGN')).toBe(2050);
  });

  it('does NOT scale a zero-decimal currency cap to minor units', () => {
    // XAF/XOF have no sub-unit: a capped zero-decimal currency (hypothetical
    // today) must keep the cap at 2,050, never 205,000, even for unit: 'minor'.
    expect(resolveCapInAmountUnit(2050, 'minor', 'XAF')).toBe(2050);
    expect(resolveCapInAmountUnit(2050, 'minor', 'XOF')).toBe(2050);
    expect(resolveCapInAmountUnit(2050, 'major', 'XAF')).toBe(2050);
  });

  it('is case-insensitive on the currency code', () => {
    expect(resolveCapInAmountUnit(2050, 'minor', 'xof')).toBe(2050);
    expect(resolveCapInAmountUnit(2050, 'minor', 'ngn')).toBe(205_000);
  });
});
