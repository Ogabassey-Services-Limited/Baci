export const DEFAULT_UTILITY_AMOUNT_LOCALE = 'en-NG';

export function createUtilityAmountFormatter(
  locale = DEFAULT_UTILITY_AMOUNT_LOCALE
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export const UTILITY_AMOUNT_FORMATTER = createUtilityAmountFormatter();

const LOCALE_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

function getUtilityAmountFormatter(locale: string): Intl.NumberFormat {
  if (locale === DEFAULT_UTILITY_AMOUNT_LOCALE) {
    return UTILITY_AMOUNT_FORMATTER;
  }

  const cachedFormatter = LOCALE_FORMATTER_CACHE.get(locale);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = createUtilityAmountFormatter(locale);
  LOCALE_FORMATTER_CACHE.set(locale, formatter);
  return formatter;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLocaleSeparators(locale: string) {
  const parts = getUtilityAmountFormatter(locale).formatToParts(12_345.6);
  return {
    decimal:
      parts.find((part) => part.type === 'decimal')?.value ??
      (locale.startsWith('en-') ? '.' : ','),
    group:
      parts.find((part) => part.type === 'group')?.value ??
      (locale.startsWith('en-') ? ',' : '.'),
  };
}

function normalizeLocaleNumberInput(input: string, locale: string): string {
  const value = input.trim();
  if (!value) {
    return '';
  }

  const { decimal, group } = getLocaleSeparators(locale);
  const decimalIndex = value.indexOf(decimal);
  const groupIndex = value.indexOf(group);
  if (
    decimal !== '.' &&
    group === '.' &&
    decimalIndex !== -1 &&
    groupIndex !== -1 &&
    decimalIndex < groupIndex
  ) {
    return '';
  }

  let normalized = value.replace(/[\u00a0\u202f]/g, ' ');
  const shouldTreatPeriodAsDecimal =
    decimal !== '.' &&
    group === '.' &&
    !value.includes(decimal) &&
    /^[-+]?\d+\.\d*$/.test(value) &&
    value.split('.')[1]?.length !== 3;
  if (group && !shouldTreatPeriodAsDecimal) {
    normalized = normalized.replace(new RegExp(escapeRegExp(group), 'g'), '');
  }
  if (group.trim() === '') {
    normalized = normalized.replace(/\s/g, '');
  }
  if (decimal && decimal !== '.' && !shouldTreatPeriodAsDecimal) {
    normalized = normalized.replace(new RegExp(escapeRegExp(decimal), 'g'), '.');
  }

  return /^[-+]?(?:\d+\.?|\d*\.\d+)(?:e[-+]?\d+)?$/i.test(normalized)
    ? normalized
    : '';
}

export function formatUtilityAmountInput(
  amount: number | string | null | undefined,
  locale = DEFAULT_UTILITY_AMOUNT_LOCALE
): string {
  if (amount === null || amount === undefined) {
    return '';
  }

  const normalizedAmount =
    typeof amount === 'number'
      ? amount
      : normalizeLocaleNumberInput(amount, locale);
  if (typeof normalizedAmount === 'string' && !normalizedAmount) {
    return '';
  }

  const numericAmount = Number(normalizedAmount);
  return Number.isFinite(numericAmount)
    ? getUtilityAmountFormatter(locale).format(numericAmount)
    : '';
}
