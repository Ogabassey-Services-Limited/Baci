import z from 'zod';
import { normalizeCountryCode } from '@/lib/normalize-country-code';

const COUNTRY_REQUIRED_MESSAGE =
  'Please select the country where your business is registered.';
const COUNTRY_UNSUPPORTED_MESSAGE = 'Please select a supported country.';

/**
 * Onboarding `country` field: accepts an ISO-2 code, a full country name, or
 * a known alias (see `@/lib/normalize-country-code`) and normalizes it into
 * the canonical ISO-2 code stored on `merchants.country`.
 *
 * The `.refine` guarantees the transformed output is never `null` — any
 * unrecognized input (including missing/empty/whitespace-only values) fails
 * validation with a merchant-facing message instead of silently persisting
 * `NULL` or a dirty free-text value (e.g. `'Nigeria'` instead of `'NG'`).
 * Both onboarding writers — `(platform)/onboarding/actions.ts` (web) and
 * `api/mobile-onboarding/route.ts` (mobile) — validate `country` through
 * this schema (via `step1BaseSchema` in `./onboarding`) before any
 * `merchants` insert/update, so `merchants.country` can no longer drift back
 * to the NULL/full-name state a prior migration had to backfill.
 */
export const onboardingCountrySchema = z
  .string({ error: COUNTRY_REQUIRED_MESSAGE })
  .transform((value) => normalizeCountryCode(value))
  .refine((value): value is string => value !== null, {
    message: COUNTRY_UNSUPPORTED_MESSAGE,
  });

export type OnboardingCountry = z.infer<typeof onboardingCountrySchema>;
