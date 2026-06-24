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

function normalizeCurrencyLabelSeparatorDashes(value: string): string {
  return value.replace(/([\p{L}\p{Sc}])\s*[-\u2212]\s*(?=\d)/gu, '$1');
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

  const trimmedValue = normalizeCurrencyLabelSeparatorDashes(value).trim();
  const dotIndex = trimmedValue.lastIndexOf('.');
  const commaIndex = trimmedValue.lastIndexOf(',');

  if (dotIndex !== -1 && commaIndex !== -1) {
    const inputDecimalSeparator = dotIndex > commaIndex ? '.' : ',';
    const inputGroupSeparator = inputDecimalSeparator === '.' ? ',' : '.';
    const mixedLocaleNormalized = trimmedValue
      .replaceAll(inputGroupSeparator, '')
      .replaceAll(inputDecimalSeparator, '.')
      .replace(/\s/g, '')
      .replace(/[^\d.+-]/g, '');

    return Number.parseFloat(mixedLocaleNormalized);
  }

  const hasLocaleDecimal = trimmedValue.includes(decimalSeparator);

  if (decimalSeparator !== '.' && dotIndex !== -1 && !hasLocaleDecimal) {
    const digitsAfterDot = trimmedValue
      .slice(dotIndex + 1)
      .replace(/\D/g, '').length;
    const dotCount = [...trimmedValue].filter((char) => char === '.').length;

    if (dotCount === 1 && digitsAfterDot !== 3) {
      return Number.parseFloat(
        trimmedValue.replace(/\s/g, '').replace(/[^\d.+-]/g, '')
      );
    }
  }

  const normalized = trimmedValue
    .replaceAll(groupSeparator, '')
    .replaceAll(decimalSeparator, '.')
    .replace(/\s/g, '')
    .replace(/[^\d.-]/g, '');

  return Number.parseFloat(normalized);
}
