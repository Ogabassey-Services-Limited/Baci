import type { CurrencyConfig } from '@/lib/currency';

/**
 * Cached PDP price formatters, keyed by `locale:code`.
 *
 * The locale is part of the key because the same currency renders differently
 * per locale (e.g. `USD` is `$999` in `en-US` but `US$999` in `en-NG`).
 */
const pdpPriceFormatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Resolve the `Intl.NumberFormat` used for PDP price strings.
 *
 * Takes the merchant's full {@link CurrencyConfig} (from
 * `resolveMerchantCurrencyConfig`) rather than a bare ISO code so non-NGN
 * merchants format in their own locale. Formatting a merchant's currency with a
 * hardcoded `en-NG` locale produced ISO-code output for every non-Nigerian
 * store (`GHS 999` instead of `GH₵999`).
 *
 * Whole amounts render without decimals (`minimumFractionDigits: 0`) while
 * fractional prices keep their cents, since `maximumFractionDigits` still
 * defaults to the currency's own digit count.
 *
 * @param currency - Resolved merchant currency (code + locale + symbol).
 * @returns A cached formatter for that locale/currency pair.
 */
export function getPdpPriceFormatter(
  currency: CurrencyConfig
): Intl.NumberFormat {
  const cacheKey = `${currency.locale}:${currency.code}`;
  let formatter = pdpPriceFormatterCache.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 0,
    });
    pdpPriceFormatterCache.set(cacheKey, formatter);
  }

  return formatter;
}
