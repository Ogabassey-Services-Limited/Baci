const formatterCache = new Map<string, Intl.NumberFormat>();
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  NGN: 'en-NG',
  INR: 'en-IN',
  GHS: 'en-GH',
  KES: 'en-KE',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  ZAR: 'en-ZA',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
  CAD: 'en-CA',
  AUD: 'en-AU',
  BRL: 'pt-BR',
  JPY: 'ja-JP',
};

type DisplayCurrencyOptions = Pick<
  Intl.NumberFormatOptions,
  'currencyDisplay' | 'minimumFractionDigits' | 'maximumFractionDigits'
>;

function getFormatterCacheKey(
  currency: string,
  options: DisplayCurrencyOptions
) {
  const normalizedOptions = normalizeDisplayCurrencyOptions(options);
  return [
    currency,
    normalizedOptions.currencyDisplay,
    normalizedOptions.minimumFractionDigits,
    normalizedOptions.maximumFractionDigits,
  ].join(':');
}

function normalizeDisplayCurrencyOptions(options: DisplayCurrencyOptions = {}) {
  const normalizedOptions: DisplayCurrencyOptions = {
    currencyDisplay: options.currencyDisplay ?? 'symbol',
  };

  if (options.minimumFractionDigits !== undefined) {
    normalizedOptions.minimumFractionDigits = options.minimumFractionDigits;
  }

  if (options.maximumFractionDigits !== undefined) {
    normalizedOptions.maximumFractionDigits = options.maximumFractionDigits;
  }

  return normalizedOptions;
}

function getDisplayCurrencyLocale(currency = 'NGN') {
  return CURRENCY_LOCALE_MAP[currency.toUpperCase()] || 'en-US';
}

export function formatDisplayCurrency(
  amount: number,
  currency = 'NGN',
  options: DisplayCurrencyOptions = {}
) {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedOptions = normalizeDisplayCurrencyOptions(options);
  const cacheKey = getFormatterCacheKey(normalizedCurrency, normalizedOptions);
  let formatter = formatterCache.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.NumberFormat(getDisplayCurrencyLocale(currency), {
      style: 'currency',
      currency: normalizedCurrency,
      ...normalizedOptions,
    });
    formatterCache.set(cacheKey, formatter);
  }

  return formatter.format(amount);
}
