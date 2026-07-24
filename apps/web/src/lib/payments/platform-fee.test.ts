import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  calculatePlatformFee as creditDirectFee,
  calculateMerchantAmount as creditDirectMerchant,
} from '../credit-direct';
import { calculatePlatformFee as korapayFee } from '../korapay';
import { calculatePlatformFee as paystackFee } from '../paystack';
import { calculatePlatformFee } from './platform-fee';

// ---------------------------------------------------------------------------
// Legacy oracles — verbatim copies of the three pre-consolidation formulas.
// The consolidated module must return EXACTLY these values (bit-for-bit).
// ---------------------------------------------------------------------------

/** Copy of the old `lib/korapay.ts` calculatePlatformFee (major units, 2dp). */
function korapayOracle(amount: number) {
  const pct = Number.parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '2');
  let platformFee = (amount * pct) / 100;
  platformFee = Math.min(platformFee, 2050);
  const merchantAmount = amount - platformFee;
  return {
    platformFee: Math.round(platformFee * 100) / 100,
    merchantAmount: Math.round(merchantAmount * 100) / 100,
    total: amount,
  };
}

/** Copy of the old `lib/paystack.ts` calculatePlatformFee (kobo, integer). */
function paystackOracle(amountInKobo: number) {
  const PCT = 2;
  let platformFee = Math.round((amountInKobo * PCT) / 100);
  platformFee = Math.min(platformFee, 2050 * 100);
  const merchantAmount = amountInKobo - platformFee;
  return { platformFee, merchantAmount, total: amountInKobo };
}

/** Copy of the old `lib/credit-direct.ts` fee helper (major units, unrounded). */
function creditDirectFeeOracle(amount: number) {
  const fee = amount * 0.02;
  const cap = 2050;
  return Math.min(fee, cap);
}
function creditDirectMerchantOracle(amount: number) {
  return amount - creditDirectFeeOracle(amount);
}

// Grids: 0, negative, tiny, float-divergence (14.25), mid, exactly-at-cap,
// above-cap, and huge.
const NAIRA_AMOUNTS = [
  0, -500, 0.5, 1, 13, 14.25, 35, 100, 1000, 12345.67, 102499.99, 102500,
  102500.01, 200000, 1_000_000, 1e9, 1e12,
];

const KOBO_AMOUNTS = [
  0, -50000, 1, 13, 24, 25, 149, 150, 250, 100000, 12345678, 10249999, 10250000,
  10250050, 20000000, 1e9, 1e12,
];

describe('calculatePlatformFee — Korapay parity (NGN, major, cents)', () => {
  beforeEach(() => {
    delete process.env.PLATFORM_FEE_PERCENTAGE;
  });

  it.each(NAIRA_AMOUNTS)(
    'matches the legacy Korapay result for amount %d',
    (amount) => {
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
    }
  );
});

describe('calculatePlatformFee — Paystack parity (NGN, minor, integer)', () => {
  it.each(KOBO_AMOUNTS)(
    'matches the legacy Paystack result for %d kobo',
    (amountInKobo) => {
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
    }
  );
});

describe('calculatePlatformFee — Credit Direct parity (NGN, major, none)', () => {
  it.each(NAIRA_AMOUNTS)(
    'matches the legacy Credit Direct fee/merchant for amount %d',
    (amount) => {
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
    }
  );
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
  ])(
    'charges 2%% uncapped for %s (2-decimal Lane-0 currency)',
    (currency, amount, expectedFee) => {
      const r = korapayFee(amount, currency as 'GHS');
      expect(r.platformFee).toBe(expectedFee);
      expect(r.merchantAmount).toBe(amount - expectedFee);
    }
  );

  it.each([
    ['XAF', 5_000_000, 100_000],
    ['XOF', 5_000_000, 100_000],
  ])(
    'charges 2%% uncapped for %s (zero-decimal CFA currency) — no ₦2,050 cap',
    (currency, amount, expectedFee) => {
      const r = korapayFee(amount, currency as 'XAF');
      expect(r.platformFee).toBe(expectedFee);
      expect(r.merchantAmount).toBe(amount - expectedFee);
    }
  );

  it('defaults to NGN when no currency is supplied (back-compat)', () => {
    expect(korapayFee(500_000)).toEqual(korapayFee(500_000, 'NGN'));
  });
});
