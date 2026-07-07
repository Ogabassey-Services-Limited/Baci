/**
 * Unified Currency Formatting System
 *
 * Centralizes all currency formatting to ensure consistency across the app
 * and dynamic currency display based on merchant's country.
 */

import { getCountryByCode } from './countries';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
}

/**
 * Locale mapping for countries to ensure proper number formatting.
 *
 * Keyed by ISO 3166-1 alpha-2 country code. Keep in sync with the country
 * coverage in `countries.ts`.
 */
export const COUNTRY_LOCALES: Record<string, string> = {
  US: 'en-US',
  NG: 'en-NG',
  GB: 'en-GB',
  CA: 'en-CA',
  AU: 'en-AU',
  DE: 'de-DE',
  FR: 'fr-FR',
  JP: 'ja-JP',
  IN: 'en-IN',
  BR: 'pt-BR',
  ZA: 'en-ZA',
  AE: 'en-AE',
  KE: 'en-KE',
  GH: 'en-GH',
  EG: 'ar-EG',
  CM: 'fr-CM',
  CI: 'fr-CI',
  SN: 'fr-SN',
  BF: 'fr-BF',
  RW: 'rw-RW',
  TZ: 'sw-TZ',
  UG: 'en-UG',
};

const CURRENCY_FALLBACK_LOCALES: Record<string, string> = {
  AUD: 'en-AU',
  BRL: 'pt-BR',
  CAD: 'en-CA',
  EUR: 'de-DE',
  GBP: 'en-GB',
  GHS: 'en-GH',
  INR: 'en-IN',
  JPY: 'ja-JP',
  KES: 'en-KE',
  NGN: 'en-NG',
  USD: 'en-US',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
  ZAR: 'en-ZA',
};

const FALLBACK_SUPPORTED_CURRENCY_CODES = new Set([
  ...Object.keys(CURRENCY_FALLBACK_LOCALES),
  'AED',
  'CHF',
  'CNY',
]);

let supportedCurrencyCodes: Set<string> | null | undefined;

function getSupportedCurrencyCodes(): Set<string> | null {
  if (supportedCurrencyCodes !== undefined) {
    return supportedCurrencyCodes;
  }

  if (typeof Intl.supportedValuesOf !== 'function') {
    supportedCurrencyCodes = null;
    return supportedCurrencyCodes;
  }

  try {
    supportedCurrencyCodes = new Set(Intl.supportedValuesOf('currency'));
  } catch {
    supportedCurrencyCodes = null;
  }

  return supportedCurrencyCodes;
}

function isValidCurrencyCode(currencyCode: string): boolean {
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return false;
  }

  const runtimeSupportedCurrencies = getSupportedCurrencyCodes();
  if (runtimeSupportedCurrencies) {
    return runtimeSupportedCurrencies.has(currencyCode);
  }

  return FALLBACK_SUPPORTED_CURRENCY_CODES.has(currencyCode);
}

function getCurrencySymbolForCode(
  currencyCode: string,
  locale: string
): string {
  try {
    const symbol = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
    })
      .formatToParts(0)
      .filter((part) => part.type === 'currency')
      .map((part) => part.value)
      .join('');
    return symbol || currencyCode;
  } catch {
    return currencyCode;
  }
}

const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  code: 'USD',
  symbol: '$',
  locale: 'en-US',
};

function getPayoutCurrencyConfig(
  payoutCurrency?: string | null
): CurrencyConfig | null {
  const normalizedCurrency = payoutCurrency?.trim().toUpperCase();
  if (!normalizedCurrency || !isValidCurrencyCode(normalizedCurrency)) {
    return null;
  }

  const locale = CURRENCY_FALLBACK_LOCALES[normalizedCurrency] || 'en-US';
  return {
    code: normalizedCurrency,
    symbol: getCurrencySymbolForCode(normalizedCurrency, locale),
    locale,
  };
}

/**
 * Common options for compact currency display (no decimals)
 * constant reference to avoid object creation on every render
 */
export const COMPACT_OPTIONS = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
} as const satisfies Partial<Intl.NumberFormatOptions>;

/**
 * Get currency configuration for a country
 * Defaults to USD if country not found
 *
 * @param countryCode - Fallback country code used when payoutCurrency is absent or invalid.
 * @param payoutCurrency - Merchant selling/payout currency; takes precedence when valid.
 *
 * @remarks
 * This is the legacy display API. Its USD fallback is intentionally preserved
 * for existing callers. New code that has a merchant record should prefer
 * `resolveMerchantCurrencyConfig` from `@/lib/resolve-merchant-currency`, which
 * is the single canonical resolver (payout-currency first, NGN platform
 * fallback) shared by display, feeds, and JSON-LD.
 *
 * @see resolveMerchantCurrencyConfig
 */
export function getCurrencyConfig(
  countryCode?: string | null,
  payoutCurrency?: string | null
): CurrencyConfig {
  const payoutConfig = getPayoutCurrencyConfig(payoutCurrency);
  const country = countryCode ? getCountryByCode(countryCode) : null;

  if (country && payoutConfig?.code === country.currency) {
    return {
      code: country.currency,
      symbol: country.currencySymbol,
      locale: COUNTRY_LOCALES[country.code] || payoutConfig.locale,
    };
  }

  if (payoutConfig) {
    return payoutConfig;
  }

  if (!country) {
    return DEFAULT_CURRENCY_CONFIG;
  }

  return {
    code: country.currency,
    symbol: country.currencySymbol,
    locale: COUNTRY_LOCALES[country.code] || 'en-US',
  };
}

const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();
const MAX_CACHE_SIZE = 100;
const MIN_FRACTION_DIGITS = 0;
const MAX_FRACTION_DIGITS = 20;

function normalizeFractionDigits(
  value: number | undefined
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(
    MAX_FRACTION_DIGITS,
    Math.max(MIN_FRACTION_DIGITS, Math.trunc(value))
  );
}

function normalizeNumberFormatOptions(
  options?: Partial<Intl.NumberFormatOptions>
): Partial<Intl.NumberFormatOptions> | undefined {
  if (!options) {
    return undefined;
  }

  const normalizedOptions: Partial<Intl.NumberFormatOptions> = { ...options };
  const minimumFractionDigits = normalizeFractionDigits(
    options.minimumFractionDigits
  );
  const maximumFractionDigits = normalizeFractionDigits(
    options.maximumFractionDigits
  );

  delete normalizedOptions.minimumFractionDigits;
  delete normalizedOptions.maximumFractionDigits;

  if (minimumFractionDigits !== undefined) {
    normalizedOptions.minimumFractionDigits = minimumFractionDigits;
  }

  if (maximumFractionDigits !== undefined) {
    const effectiveMinimumFractionDigits =
      minimumFractionDigits ?? Math.min(2, maximumFractionDigits);
    normalizedOptions.minimumFractionDigits = effectiveMinimumFractionDigits;
    normalizedOptions.maximumFractionDigits = Math.max(
      maximumFractionDigits,
      effectiveMinimumFractionDigits
    );
  } else if (minimumFractionDigits !== undefined) {
    normalizedOptions.maximumFractionDigits = Math.max(
      2,
      minimumFractionDigits
    );
  }

  return normalizedOptions;
}

/**
 * Optimized currency formatter using a pre-calculated config
 * Avoids recalculating config on every call
 */
export function formatCurrencyWithConfig(
  amount: number,
  config: CurrencyConfig,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  const normalizedOptions = normalizeNumberFormatOptions(options);

  try {
    let cacheKey: string;

    // Optimized: check for reference equality first for COMPACT_OPTIONS to skip JSON.stringify
    if (options === COMPACT_OPTIONS) {
      cacheKey = `${config.locale}:${config.code}:compact`;
    } else if (
      !normalizedOptions ||
      Object.keys(normalizedOptions).length === 0
    ) {
      cacheKey = `${config.locale}:${config.code}`;
    } else {
      cacheKey = JSON.stringify({
        locale: config.locale,
        currency: config.code,
        ...normalizedOptions,
      });
    }

    let formatter = FORMATTER_CACHE.get(cacheKey);

    if (!formatter) {
      formatter = new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.code,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...normalizedOptions,
      });

      // LRU eviction: remove least-recently-used entry when cache is full
      if (FORMATTER_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = FORMATTER_CACHE.keys().next().value;
        if (firstKey !== undefined) {
          FORMATTER_CACHE.delete(firstKey);
        }
      }
      FORMATTER_CACHE.set(cacheKey, formatter);
    } else {
      // Move to end to indicate "Recent" usage (LRU order)
      FORMATTER_CACHE.delete(cacheKey);
      FORMATTER_CACHE.set(cacheKey, formatter);
    }

    return formatter.format(amount);
  } catch {
    // Fallback for unsupported locales
    const digits = normalizedOptions?.maximumFractionDigits ?? 2;
    return `${config.symbol}${amount.toFixed(digits)}`;
  }
}

/**
 * Format a number as currency based on country code
 *
 * @param amount - The amount to format
 * @param countryCode - The country code (e.g., 'NG', 'US', 'GB')
 * @param options - Additional Intl.NumberFormat options
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1000, 'NG') // "₦1,000.00"
 * formatCurrency(1000, 'US') // "$1,000.00"
 * formatCurrency(1000, 'GB') // "£1,000.00"
 */
export function formatCurrency(
  amount: number,
  countryCode?: string | null,
  options?: Partial<Intl.NumberFormatOptions>,
  payoutCurrency?: string | null
): string {
  const config = getCurrencyConfig(countryCode, payoutCurrency);
  return formatCurrencyWithConfig(amount, config, options);
}

/**
 * Format currency without decimals (for display of whole numbers)
 *
 * @example
 * formatCurrencyCompact(1000, 'NG') // "₦1,000"
 */
export function formatCurrencyCompact(
  amount: number,
  countryCode?: string | null
): string {
  return formatCurrency(amount, countryCode, COMPACT_OPTIONS);
}

/**
 * Get just the currency symbol for a country
 *
 * @param countryCode - Fallback country code used when payoutCurrency is absent or invalid.
 * @param payoutCurrency - Merchant selling/payout currency; takes precedence when valid.
 *
 * @example
 * getCurrencySymbol('NG') // "₦"
 * getCurrencySymbol('US') // "$"
 */
export function getCurrencySymbol(
  countryCode?: string | null,
  payoutCurrency?: string | null
): string {
  const config = getCurrencyConfig(countryCode, payoutCurrency);
  return config.symbol;
}

/**
 * Get the currency code for a country
 *
 * @param countryCode - Fallback country code used when payoutCurrency is absent or invalid.
 * @param payoutCurrency - Merchant selling/payout currency; takes precedence when valid.
 *
 * @example
 * getCurrencyCode('NG') // "NGN"
 * getCurrencyCode('US') // "USD"
 */
export function getCurrencyCode(
  countryCode?: string | null,
  payoutCurrency?: string | null
): string {
  const config = getCurrencyConfig(countryCode, payoutCurrency);
  return config.code;
}
