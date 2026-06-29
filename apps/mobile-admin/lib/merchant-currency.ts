import { COUNTRIES } from '@/constants/countries';

const FALLBACK_SUPPORTED_MERCHANT_CURRENCY_CODES = new Set(
  COUNTRIES.map(({ currency }) => currency.trim().toUpperCase()).filter(
    (currency) => /^[A-Z]{3}$/.test(currency)
  )
);

let supportedMerchantCurrencyCodes: Set<string> | null | undefined;

function getSupportedMerchantCurrencyCodes(): Set<string> | null {
  if (supportedMerchantCurrencyCodes !== undefined) {
    return supportedMerchantCurrencyCodes;
  }

  if (typeof Intl.supportedValuesOf !== 'function') {
    supportedMerchantCurrencyCodes = null;
    return supportedMerchantCurrencyCodes;
  }

  try {
    supportedMerchantCurrencyCodes = new Set(Intl.supportedValuesOf('currency'));
  } catch {
    supportedMerchantCurrencyCodes = null;
  }

  return supportedMerchantCurrencyCodes;
}

function isSupportedMerchantCurrency(currency: string): boolean {
  if (!/^[A-Z]{3}$/.test(currency)) return false;

  if (FALLBACK_SUPPORTED_MERCHANT_CURRENCY_CODES.has(currency)) {
    return true;
  }

  const runtimeSupportedCurrencies = getSupportedMerchantCurrencyCodes();
  return runtimeSupportedCurrencies?.has(currency) ?? false;
}

const validCurrencyCache = new Set<string>();

export function normalizeMerchantCurrency(
  currency?: string | null
): string | undefined {
  if (!currency) return undefined;

  const normalizedCurrency = currency.trim().toUpperCase();
  if (!normalizedCurrency) return undefined;
  if (normalizedCurrency === 'NGN') return normalizedCurrency;

  if (validCurrencyCache.has(normalizedCurrency)) {
    return normalizedCurrency;
  }

  if (!isSupportedMerchantCurrency(normalizedCurrency)) {
    return undefined;
  }

  try {
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    });
    if (validCurrencyCache.size > 50) validCurrencyCache.clear();
    validCurrencyCache.add(normalizedCurrency);
    return normalizedCurrency;
  } catch {
    return undefined;
  }
}
