/**
 * Currency presentation metadata used by the canonical merchant currency
 * resolver (`resolve-merchant-currency.ts`).
 *
 * These maps are keyed by ISO 4217 currency code and provide deterministic
 * fallbacks when a merchant's currency cannot be tied back to a known country
 * entry in `countries.ts` (e.g. `payout_currency` is set but `country` is null).
 *
 * Keep entries in sync with the country coverage in `countries.ts`.
 */

/**
 * Preferred display symbol per currency code.
 *
 * Used when no matching country entry supplies a symbol. Falls back to the
 * currency code itself when a code is not listed here.
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: '$',
  AUD: '$',
  JPY: '¥',
  INR: '₹',
  BRL: 'R$',
  ZAR: 'R',
  AED: 'د.إ',
  KES: 'KSh',
  GHS: 'GH₵',
  XAF: 'FCFA',
  XOF: 'CFA',
  EGP: 'E£',
  RWF: 'FRw',
  TZS: 'TSh',
  UGX: 'USh',
};

/**
 * Sensible default BCP 47 locale per currency code.
 *
 * Used when a merchant's country is unknown but the currency is resolved, so
 * number grouping / decimal conventions still match the currency's home market.
 * Falls back to `en-US` for unlisted codes.
 */
export const CURRENCY_DEFAULT_LOCALES: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  CAD: 'en-CA',
  AUD: 'en-AU',
  JPY: 'ja-JP',
  INR: 'en-IN',
  BRL: 'pt-BR',
  ZAR: 'en-ZA',
  AED: 'en-AE',
  KES: 'en-KE',
  GHS: 'en-GH',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
  EGP: 'ar-EG',
  RWF: 'rw-RW',
  TZS: 'sw-TZ',
  UGX: 'en-UG',
};
