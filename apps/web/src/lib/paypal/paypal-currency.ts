import type { PayPalResult } from './paypal-types';

export const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'AUD',
  'BRL',
  'CAD',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'HKD',
  'HUF',
  'ILS',
  'JPY',
  'MYR',
  'MXN',
  'TWD',
  'NZD',
  'NOK',
  'PHP',
  'PLN',
  'GBP',
  'SGD',
  'SEK',
  'CHF',
  'THB',
  'USD',
]);

export const PAYPAL_ZERO_DECIMAL_CURRENCIES = new Set(['HUF', 'JPY', 'TWD']);

/**
 * Validates that `currency` is one PayPal natively accepts as a presentment
 * currency. Deliberately rejects everything else (e.g. NGN) instead of
 * silently converting — FX conversion, if ever added, is a route-layer
 * concern (see docs/payments/byok-payment-providers-plan.md Phase 2 item 5).
 */
export function normalizePayPalCurrency(
  currency: string
): PayPalResult<string> {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!PAYPAL_SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    return {
      success: false,
      error: `PayPal does not support ${normalizedCurrency} as a presentment currency`,
      code: 'UNSUPPORTED_CURRENCY',
    };
  }
  return { success: true, data: normalizedCurrency };
}

/**
 * Formats `amount` per PayPal's currency-specific decimal rules. Assumes
 * `currency` has already been normalized via `normalizePayPalCurrency`.
 */
export function formatPayPalAmount(
  amount: number,
  currency: string
): PayPalResult<string> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      error: 'PayPal amount must be greater than zero',
      code: 'INVALID_AMOUNT',
    };
  }

  if (PAYPAL_ZERO_DECIMAL_CURRENCIES.has(currency)) {
    if (!Number.isInteger(amount)) {
      return {
        success: false,
        error: `${currency} PayPal amounts must not include decimal places`,
        code: 'INVALID_AMOUNT',
      };
    }
    return { success: true, data: String(amount) };
  }

  return { success: true, data: amount.toFixed(2) };
}
