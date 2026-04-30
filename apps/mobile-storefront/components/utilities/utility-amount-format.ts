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

const DOT_DECIMAL_SEPARATORS = { decimal: '.', group: ',' } as const;
const COMMA_DECIMAL_SEPARATORS = { decimal: ',', group: '.' } as const;
const COMMA_DECIMAL_SPACE_GROUP_SEPARATORS = {
  decimal: ',',
  group: ' ',
} as const;
const DOT_DECIMAL_APOSTROPHE_GROUP_SEPARATORS = {
  decimal: '.',
  group: '’',
} as const;
type FallbackSeparators =
  | typeof DOT_DECIMAL_SEPARATORS
  | typeof COMMA_DECIMAL_SEPARATORS
  | typeof COMMA_DECIMAL_SPACE_GROUP_SEPARATORS
  | typeof DOT_DECIMAL_APOSTROPHE_GROUP_SEPARATORS;

// Region-specific overrides take precedence over the language-only map.
// Several locales diverge from their language defaults (e.g. pt-BR uses
// dot grouping while pt-PT uses NBSP), so we keep an explicit override
// table for the regions most likely to be encountered.
const FALLBACK_REGION_SEPARATORS: Record<string, FallbackSeparators> = {
  // Swiss German/Italian use apostrophe; Swiss French uses NNBSP.
  'de-ch': DOT_DECIMAL_APOSTROPHE_GROUP_SEPARATORS,
  'it-ch': DOT_DECIMAL_APOSTROPHE_GROUP_SEPARATORS,
  'fr-ch': COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  // Brazilian Portuguese uses dot grouping unlike European Portuguese.
  'pt-br': COMMA_DECIMAL_SEPARATORS,
  // Austrian German uses NBSP grouping unlike de-DE / de-LU.
  'de-at': COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  // Latin American Spanish uses dot decimal / comma group.
  'es-419': DOT_DECIMAL_SEPARATORS,
  'es-mx': DOT_DECIMAL_SEPARATORS,
  'es-pe': DOT_DECIMAL_SEPARATORS,
  // Canadian French uses NBSP grouping (vs fr-FR NNBSP, but both treated as
  // generic space groups by normalizeLocaleNumberInput).
  'fr-ca': COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  // Luxembourgish French uses dot grouping (Belgian Dutch convention).
  'fr-lu': COMMA_DECIMAL_SEPARATORS,
  // South African English uses NBSP groups and comma decimal.
  'en-za': COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
};

const FALLBACK_LOCALE_SEPARATORS: Record<string, FallbackSeparators> = {
  bg: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  cs: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  da: COMMA_DECIMAL_SEPARATORS,
  de: COMMA_DECIMAL_SEPARATORS,
  el: COMMA_DECIMAL_SEPARATORS,
  en: DOT_DECIMAL_SEPARATORS,
  es: COMMA_DECIMAL_SEPARATORS,
  fi: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  fr: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  hu: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  it: COMMA_DECIMAL_SEPARATORS,
  ja: DOT_DECIMAL_SEPARATORS,
  ko: DOT_DECIMAL_SEPARATORS,
  nl: COMMA_DECIMAL_SEPARATORS,
  no: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  pl: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  pt: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  ro: COMMA_DECIMAL_SEPARATORS,
  ru: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  sk: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  sv: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  tr: COMMA_DECIMAL_SEPARATORS,
  uk: COMMA_DECIMAL_SPACE_GROUP_SEPARATORS,
  zh: DOT_DECIMAL_SEPARATORS,
};

function getFallbackLocaleSeparators(locale: string): FallbackSeparators {
  // Strip BCP-47 extension subtags (e.g. `-u-nu-latn`) and case-normalize so
  // region overrides match regardless of how the caller wrote the tag.
  const normalized = locale
    .replace(/_/g, '-')
    .replace(/-[a-z]-.+$/i, '')
    .toLowerCase();
  const regionOverride = FALLBACK_REGION_SEPARATORS[normalized];
  if (regionOverride) {
    return regionOverride;
  }
  const language = normalized.split('-')[0] ?? '';
  return FALLBACK_LOCALE_SEPARATORS[language] ?? DOT_DECIMAL_SEPARATORS;
}

function getLocaleSeparators(locale: string) {
  const formatter = getUtilityAmountFormatter(locale);
  if (typeof formatter.formatToParts !== 'function') {
    return getFallbackLocaleSeparators(locale);
  }

  const parts = formatter.formatToParts(12_345.6);
  const fallbackSeparators = getFallbackLocaleSeparators(locale);
  return {
    decimal:
      parts.find((part) => part.type === 'decimal')?.value ??
      fallbackSeparators.decimal,
    group:
      parts.find((part) => part.type === 'group')?.value ??
      fallbackSeparators.group,
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
