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

// Cache for Intl.NumberFormat instances to prevent expensive re-creation
// This significantly improves performance when rendering lists of prices (e.g. product grids)
const formatterCache = new Map<string, Intl.NumberFormat>();

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

  try {
    const finalOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: config.code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    };

    // Create a cache key based on locale, currency, and options
    // JSON.stringify is fast enough for small option objects vs Intl instantiation
    const cacheKey = `${config.locale}-${config.code}-${JSON.stringify(options || {})}`;

    let formatter = formatterCache.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.NumberFormat(config.locale, finalOptions);
      formatterCache.set(cacheKey, formatter);
    }

    return formatter.format(amount);
  } catch {
    // Fallback for unsupported locales
    return `${config.symbol}${amount.toFixed(2)}`;
  }
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
