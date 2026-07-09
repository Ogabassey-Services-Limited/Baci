/**
 * Shared currency presentation metadata for the admin app.
 *
 * Single source of truth for currency code -> display symbol and code ->
 * formatting locale, consumed by `format-merchant-currency.ts`,
 * `product.shared.ts`, and `order-details.helpers.ts` so new currencies only
 * need to be added in one place.
 */

export const MERCHANT_CURRENCY_SYMBOLS: Record<string, string> = {
  AED: 'د.إ',
  AUD: '$',
  BRL: 'R$',
  CAD: '$',
  EGP: 'E£',
  EUR: '€',
  GBP: '£',
  GHS: 'GH₵',
  INR: '₹',
  JPY: '¥',
  KES: 'KSh',
  NGN: '₦',
  USD: '$',
  XAF: 'FCFA',
  XOF: 'CFA',
  ZAR: 'R',
};

/**
 * Locale used to format each supported currency so grouping/decimal
 * conventions follow the currency's home market rather than the device's
 * runtime locale (e.g. Indian lakh/crore grouping for INR, or the Naira
 * glyph for NGN, which some locales' CLDR data render as the bare "NGN"
 * code instead of "₦"). Currencies without an entry fall back to the
 * runtime/device locale.
 */
export const MERCHANT_CURRENCY_LOCALES: Record<string, string> = {
  AED: 'en-AE',
  AUD: 'en-AU',
  BRL: 'pt-BR',
  CAD: 'en-CA',
  EGP: 'en-EG',
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

/**
 * Display symbol for a currency code. Unknown but present codes return the
 * code itself (never a wrong symbol); missing input falls back to NGN.
 */
export function getMerchantCurrencySymbol(
  currencyCode: string | null | undefined
): string {
  const normalizedCode = (currencyCode || 'NGN').trim().toUpperCase();
  return MERCHANT_CURRENCY_SYMBOLS[normalizedCode] || normalizedCode;
}
