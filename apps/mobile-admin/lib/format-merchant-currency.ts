import { COUNTRIES } from '@/constants/countries';
import { formatCurrency, normalizeMerchantCurrency } from './utils';

/**
 * Minimal merchant shape needed to resolve a display currency. Accepts the
 * full `Merchant` type from `useMerchant`, an order row (which carries the
 * merchant's payout currency at order time), or an ad-hoc object — any
 * caller that only has a currency/country pair on hand.
 */
export interface MerchantCurrencyProfile {
  payout_currency?: string | null;
  country?: string | null;
}

const DEFAULT_MERCHANT_CURRENCY = 'NGN';

/**
 * Locale used to format each supported currency so grouping/decimal
 * conventions follow the currency's home market rather than the device's
 * runtime locale (e.g. Indian lakh/crore grouping for INR, or the Naira
 * glyph for NGN, which some locales' CLDR data render as the bare "NGN"
 * code instead of "₦"). Currencies without an entry fall back to the
 * runtime/device locale, matching the existing `formatCurrency`/
 * `useCurrency` behavior.
 */
const MERCHANT_CURRENCY_LOCALES: Record<string, string> = {
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

function resolveCountryCurrency(country?: string | null): string | undefined {
  const normalizedCountry = country?.trim().toUpperCase();
  if (!normalizedCountry) return undefined;

  const match = COUNTRIES.find((entry) => entry.code === normalizedCountry);
  return match ? normalizeMerchantCurrency(match.currency) : undefined;
}

/**
 * Resolves the ISO-4217 currency code for a merchant using the same
 * payout_currency-first fallback chain the web backend uses:
 * payout_currency -> country-derived currency -> NGN.
 */
function resolveMerchantCurrency(
  merchant?: MerchantCurrencyProfile | null
): string {
  return (
    normalizeMerchantCurrency(merchant?.payout_currency) ??
    resolveCountryCurrency(merchant?.country) ??
    DEFAULT_MERCHANT_CURRENCY
  );
}

/**
 * Formats `amount` using the merchant's resolved currency and a locale that
 * matches that currency's home-market formatting conventions. Intended for
 * non-hook contexts (generated PDF/HTML reports, plain utilities); React
 * components should prefer the `useCurrency` hook, which shares the same
 * underlying `formatCurrency` implementation.
 */
export function formatMerchantAmount(
  amount: number,
  merchant?: MerchantCurrencyProfile | null,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  const currency = resolveMerchantCurrency(merchant);
  const locale = MERCHANT_CURRENCY_LOCALES[currency];
  return formatCurrency(amount, options, currency, locale);
}
