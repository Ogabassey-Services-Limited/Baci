const _priceFormatterCache = new Map<string, Intl.NumberFormat>();
function getPriceFormatter(locale: string): Intl.NumberFormat {
  let formatter = _priceFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    _priceFormatterCache.set(locale, formatter);
  }
  return formatter;
}

const _currencySymbolFormatterCache = new Map<string, Intl.NumberFormat>();
function getCurrencySymbolFormatter(
  locale: string,
  currency: string
): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = _currencySymbolFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    });
    _currencySymbolFormatterCache.set(key, formatter);
  }
  return formatter;
}

export function formatPriceInput(amount: number, locale: string): string {
  return getPriceFormatter(locale).format(amount);
}

export function getCurrencySymbol(locale: string, currency: string): string {
  return getCurrencySymbolFormatter(locale, currency)
    .formatToParts(0)
    .filter((part) => part.type === 'currency')
    .map((part) => part.value)
    .join('');
}

export function parsePriceInput(value: string, locale: string): number {
  const parts = getPriceFormatter(locale).formatToParts(12345.6);
  const groupSeparator =
    parts.find((part) => part.type === 'group')?.value ?? ',';
  const decimalSeparator =
    parts.find((part) => part.type === 'decimal')?.value ?? '.';

  const normalized = value
    .replaceAll(groupSeparator, '')
    .replaceAll(decimalSeparator, '.')
    .replace(/\s/g, '')
    .replace(/[^\d.-]/g, '');

  return Number.parseFloat(normalized);
}
