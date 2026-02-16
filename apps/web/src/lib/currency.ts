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
 * Locale mapping for countries to ensure proper number formatting
 */
const COUNTRY_LOCALES: Record<string, string> = {
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
};

/**
 * Get currency configuration for a country
 * Defaults to USD if country not found
 */
export function getCurrencyConfig(countryCode?: string | null): CurrencyConfig {
  if (!countryCode) {
    return {
      code: 'USD',
      symbol: '$',
      locale: 'en-US',
    };
  }

  const country = getCountryByCode(countryCode);

  if (!country) {
    return {
      code: 'USD',
      symbol: '$',
      locale: 'en-US',
    };
  }

  return {
    code: country.currency,
    symbol: country.currencySymbol,
    locale: COUNTRY_LOCALES[country.code] || 'en-US',
  };
}

const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();
const MAX_CACHE_SIZE = 100;

// Optimization: Cache the last used configuration to skip Map lookups
// This significantly improves performance for list rendering where currency stays consistent
let lastConfig: CurrencyConfig | null = null;
let lastOptions: Partial<Intl.NumberFormatOptions> | undefined;
let lastFormatter: Intl.NumberFormat | null = null;

/**
 * Optimized currency formatter using a pre-calculated config
 * Avoids recalculating config on every call
 */
export function formatCurrencyWithConfig(
  amount: number,
  config: CurrencyConfig,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  try {
    // Optimization: fast path for repeated calls with same config/options reference
    // This avoids JSON.stringify and Map lookups entirely for sequential calls
    if (config === lastConfig && options === lastOptions && lastFormatter) {
      return lastFormatter.format(amount);
    }

    // Generate cache key based on config and options
    // Optimized: avoid JSON.stringify for the common case (no custom options)
    // Check !options first to avoid Object.keys allocation in the hot path
    const cacheKey =
      !options || Object.keys(options).length === 0
        ? `${config.locale}:${config.code}`
        : JSON.stringify({
            locale: config.locale,
            currency: config.code,
            ...options,
          });

    let formatter = FORMATTER_CACHE.get(cacheKey);

    if (!formatter) {
      formatter = new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.code,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options,
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

    // Update last accessed cache
    lastConfig = config;
    lastOptions = options;
    lastFormatter = formatter;

    return formatter.format(amount);
  } catch {
    // Fallback for unsupported locales
    return `${config.symbol}${amount.toFixed(2)}`;
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
  options?: Partial<Intl.NumberFormatOptions>
): string {
  const config = getCurrencyConfig(countryCode);
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
  return formatCurrency(amount, countryCode, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Get just the currency symbol for a country
 *
 * @example
 * getCurrencySymbol('NG') // "₦"
 * getCurrencySymbol('US') // "$"
 */
export function getCurrencySymbol(countryCode?: string | null): string {
  const config = getCurrencyConfig(countryCode);
  return config.symbol;
}

/**
 * Get the currency code for a country
 *
 * @example
 * getCurrencyCode('NG') // "NGN"
 * getCurrencyCode('US') // "USD"
 */
export function getCurrencyCode(countryCode?: string | null): string {
  const config = getCurrencyConfig(countryCode);
  return config.code;
}
