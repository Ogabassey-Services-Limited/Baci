export type CacRegistrationPrefix = 'BN' | 'RC';

export interface ParsedCacRegistration {
  canonicalSearchTerm: string;
  digits: string;
  prefix: CacRegistrationPrefix | null;
}

const PREFIXED_CAC_REGISTRATION_PATTERN = /^(rc|bn)\s*-?\s*([\d\s-]+)$/i;
const DIGITS_ONLY_CAC_REGISTRATION_PATTERN = /^[\d\s-]+$/;

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function parseCacRegistration(
  value?: string | null,
  defaultPrefix?: CacRegistrationPrefix | null
): ParsedCacRegistration | null {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return null;
  }

  const prefixedMatch = trimmed.match(PREFIXED_CAC_REGISTRATION_PATTERN);
  if (prefixedMatch) {
    const digits = normalizeDigits(prefixedMatch[2]);
    if (!digits) return null;

    const prefix = prefixedMatch[1].toUpperCase() as CacRegistrationPrefix;
    return {
      canonicalSearchTerm: `${prefix}${digits}`,
      digits,
      prefix,
    };
  }

  if (DIGITS_ONLY_CAC_REGISTRATION_PATTERN.test(trimmed)) {
    const digits = normalizeDigits(trimmed);
    if (!digits) return null;

    return {
      canonicalSearchTerm: defaultPrefix ? `${defaultPrefix}${digits}` : digits,
      digits,
      prefix: defaultPrefix ?? null,
    };
  }

  return null;
}

export function normalizeCacSearchTerm(
  value: string,
  defaultPrefix?: CacRegistrationPrefix | null
): string {
  const parsed = parseCacRegistration(value, defaultPrefix);
  return parsed?.canonicalSearchTerm ?? value.trim();
}
