import { getCountryByCode } from '@/lib/countries';

/**
 * Colloquial / non-ISO-2 aliases that free-text country input (legacy
 * clients, copy-pasted values, manual data entry) commonly uses in place of
 * the ISO-2 code. Keys are matched case-insensitively after trimming.
 *
 * Scope decision: this only covers the handful of aliases merchants
 * realistically type — it is NOT a full ISO 3166-1 alpha-3 table. Extend it
 * if a new alias shows up in dirty data, rather than pre-populating every
 * possible alpha-3 code.
 *
 * An alias only "wins" once its target ISO-2 code exists in `COUNTRIES`
 * (see `@/lib/countries`) — `normalizeCountryCode` resolves every candidate
 * through `getCountryByCode`, so e.g. 'UAE' keeps returning `null` for as
 * long as 'AE' is absent from `COUNTRIES`.
 */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  USA: 'US',
  UK: 'GB',
  UAE: 'AE',
};

/**
 * Normalizes free-form country input — an ISO-2 code, a full country name,
 * or a known alias (see {@link COUNTRY_ALIASES}) — into the canonical
 * ISO-2 code recognized by `COUNTRIES`.
 *
 * Returns `null` for any input that cannot be resolved to a supported
 * country, including `null`/`undefined`/empty/whitespace-only input. This
 * is the single normalization point onboarding writers use before
 * persisting `merchants.country`, so a merchant row can never end up with a
 * `NULL` country or a dirty free-text value (e.g. the full name `'Nigeria'`
 * instead of `'NG'`) that a prior migration had to backfill.
 */
export function normalizeCountryCode(
  input: string | null | undefined
): string | null {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const alias = COUNTRY_ALIASES[trimmed.toUpperCase()];
  const resolved = getCountryByCode(alias ?? trimmed);
  return resolved ? resolved.code : null;
}
