import z from 'zod';

export { extractBrandColorsFromImage as extractColorsFromImage } from '@/lib/extract-brand-colors';

import { sanitizeText } from '@/lib/sanitize-core';
import { onboardingCountrySchema } from '@/schemas/onboarding-country';

export const settingsSchema = z.object({
  business_name: z
    .string()
    // Trim first so a stray trailing/leading space can't be saved as the store
    // name (the DB also normalizes this; see the aa_normalize_merchant_business_name
    // trigger). Length is checked against the trimmed value.
    .trim()
    .min(2, 'Business name must be at least 2 characters.'),
  // Shared with onboarding: accepts an ISO-2 code, a full country name, or a
  // known alias and normalizes it to the canonical ISO-2 code, so the
  // settings form can never round-trip 'Nigeria' or other free-text garbage
  // back into `merchants.country`.
  country: onboardingCountrySchema,
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export const sanitizeSocialMedia = (social: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(social).map(([key, value]) => [
      key,
      sanitizeText(value.trim()),
    ])
  );
};
