/**
 * Platform fee computation — single source of truth.
 *
 * Consolidates the three historically-duplicated 2% platform-fee helpers
 * (`lib/korapay.ts`, `lib/paystack.ts`, `lib/credit-direct.ts`). Each caller
 * had subtly different arithmetic that fed real money paths, so this module
 * reproduces every one of those profiles *bit-for-bit* rather than silently
 * unifying them. The differences are encoded in {@link PlatformFeeOptions} and
 * documented below so nothing changes for existing callers.
 *
 * Per-currency config (per the BYOK plan, Phase 0.4):
 * - NGN keeps the historical **2% capped at ₦2,050**.
 * - Every other currency is **percentage-only (no cap)** — future BYOK/Lane-0
 *   currencies (KES/GHS/ZAR/USD/EUR/GBP…) settle without the NGN-specific cap.
 *
 * Intentional per-caller divergences (do NOT "clean up" without re-proving parity):
 * - **Env override**: only Korapay honoured `PLATFORM_FEE_PERCENTAGE`. That is
 *   preserved via `honorEnvPercentageOverride` — Paystack and Credit Direct
 *   keep their fixed 2% and must NOT read the env var.
 * - **Raw-fee expression**: Credit Direct computed `amount * (pct / 100)`
 *   (i.e. `amount * 0.02`) and returned it UNROUNDED, whereas Korapay/Paystack
 *   computed `(amount * pct) / 100`. These produce different doubles for many
 *   inputs (e.g. 14.25 → 0.28 vs 0.29 after 2dp rounding), so the `'none'`
 *   rounding mode uses the rate-multiply form and the others use the
 *   divide-after form. `2 / 100 === 0.02` exactly as IEEE-754 doubles, so the
 *   rate-multiply form reproduces Credit Direct's literal `0.02`.
 */

/** Amount unit. `'minor'` (e.g. kobo) scales the NGN cap by 100. */
export type PlatformFeeUnit = 'major' | 'minor';

/**
 * Rounding profile — also selects the raw-fee expression and cap order so the
 * legacy callers stay bit-for-bit identical:
 * - `'none'`    → Credit Direct: `amount * (pct/100)`, cap only, no rounding.
 * - `'cents'`   → Korapay: `(amount*pct)/100`, cap, then round to 2 decimals.
 * - `'integer'` → Paystack: `Math.round((amount*pct)/100)`, then cap.
 */
export type PlatformFeeRounding = 'none' | 'cents' | 'integer';

export interface PlatformFeeOptions {
  /** ISO-4217 currency of `amount`. Only NGN is capped; others are uncapped. */
  currency: string;
  /** Unit of `amount`. Defaults to `'major'`. */
  unit?: PlatformFeeUnit;
  /** Rounding/arithmetic profile. Defaults to `'cents'`. */
  rounding?: PlatformFeeRounding;
  /**
   * When true, `PLATFORM_FEE_PERCENTAGE` env overrides the configured percentage
   * (Korapay-only legacy behavior). Defaults to false.
   */
  honorEnvPercentageOverride?: boolean;
}

export interface PlatformFeeResult {
  /** Platform's cut, in the same unit as the input `amount`. */
  platformFee: number;
  /** Amount left for the merchant after the fee, same unit. */
  merchantAmount: number;
  /** The original gross `amount`, echoed back, same unit. */
  total: number;
}

interface CurrencyFeeConfig {
  /** Fee percentage (e.g. 2 for 2%). */
  percentage: number;
  /** Cap in MAJOR currency units, or null for percentage-only (no cap). */
  capMajor: number | null;
}

const DEFAULT_PERCENTAGE = 2;
const NGN_CAP_MAJOR = 2050;

/**
 * ISO-4217 zero-decimal currencies (no minor unit). Fees and merchant residuals
 * in these currencies MUST be whole units — a fractional value like XOF 10,000.02
 * is unrepresentable and would break settlement/display. Korapay's Lane-0 CFA
 * currencies (XAF/XOF) are the reachable cases here; the rest are included so the
 * single-source-of-truth stays correct for any zero-decimal currency added later.
 */
const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/**
 * Per-currency fee configuration. NGN is capped; everything else is
 * percentage-only. Extend here (never in call sites) as new markets land.
 */
const CURRENCY_FEE_CONFIG: Readonly<Record<string, CurrencyFeeConfig>> = {
  NGN: { percentage: DEFAULT_PERCENTAGE, capMajor: NGN_CAP_MAJOR },
};

function getCurrencyFeeConfig(currency: string): CurrencyFeeConfig {
  return (
    CURRENCY_FEE_CONFIG[currency.toUpperCase()] ?? {
      percentage: DEFAULT_PERCENTAGE,
      capMajor: null,
    }
  );
}

function resolvePercentage(
  config: CurrencyFeeConfig,
  honorEnvPercentageOverride: boolean
): number {
  if (!honorEnvPercentageOverride) {
    return config.percentage;
  }
  // Mirrors Korapay's historical `process.env.PLATFORM_FEE_PERCENTAGE || '2'`.
  return Number.parseFloat(
    process.env.PLATFORM_FEE_PERCENTAGE || String(config.percentage)
  );
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Express a major-unit cap in the amount's own unit. Zero-decimal currencies
 * (XAF/XOF/…) have no sub-unit, so their `'minor'` amount equals the major
 * amount — their cap must NOT be multiplied by 100. Two-decimal currencies scale
 * a `'minor'` cap by 100 (e.g. NGN ₦2,050 → 205,000 kobo). Exported for direct
 * unit testing of the zero-decimal branch, which is unreachable via the public
 * API today (only NGN is capped and NGN is 2-decimal).
 */
export function resolveCapInAmountUnit(
  capMajor: number,
  unit: PlatformFeeUnit,
  currency: string
): number {
  const scaleToMinor =
    unit === 'minor' && !ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  return scaleToMinor ? capMajor * 100 : capMajor;
}

/**
 * Compute the platform fee and the merchant's residual amount for a gross
 * `amount`. See the module header for the parity guarantees.
 */
export function calculatePlatformFee(
  amount: number,
  options: PlatformFeeOptions
): PlatformFeeResult {
  const {
    currency,
    unit = 'major',
    rounding = 'cents',
    honorEnvPercentageOverride = false,
  } = options;

  const config = getCurrencyFeeConfig(currency);
  const percentage = resolvePercentage(config, honorEnvPercentageOverride);

  // Raw fee: 'none' preserves Credit Direct's `amount * (pct/100)` float profile;
  // 'cents'/'integer' preserve Korapay/Paystack's `(amount * pct) / 100`.
  let fee =
    rounding === 'none'
      ? amount * (percentage / 100)
      : (amount * percentage) / 100;

  // Paystack rounds to whole minor units BEFORE capping.
  if (rounding === 'integer') {
    fee = Math.round(fee);
  }

  // Cap applies to NGN only; express it in the amount's unit (see helper — inert
  // today for zero-decimal currencies since only NGN is capped, and NGN is 2-decimal).
  if (config.capMajor !== null) {
    fee = Math.min(
      fee,
      resolveCapInAmountUnit(config.capMajor, unit, currency)
    );
  }

  const merchantAmount = amount - fee;

  if (rounding === 'cents') {
    // Zero-decimal currencies (XAF/XOF/…) cannot carry a fractional fee, so round
    // to whole units and derive the residual from the rounded fee to keep
    // fee + merchant === total exactly. NGN and other 2-decimal currencies keep
    // the historical cents rounding, so this path is a strict superset (NGN is
    // bit-for-bit unchanged — it is not zero-decimal).
    if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
      const wholeFee = Math.round(fee);
      return {
        platformFee: wholeFee,
        merchantAmount: amount - wholeFee,
        total: amount,
      };
    }
    return {
      platformFee: roundToCents(fee),
      merchantAmount: roundToCents(merchantAmount),
      total: amount,
    };
  }

  return { platformFee: fee, merchantAmount, total: amount };
}
