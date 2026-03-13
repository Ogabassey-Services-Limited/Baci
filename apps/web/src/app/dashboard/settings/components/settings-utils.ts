import z from 'zod';

export { extractBrandColorsFromImage as extractColorsFromImage } from '@/lib/extract-brand-colors';

import { sanitizeText } from '@/lib/sanitize-core';

export const settingsSchema = z.object({
  business_name: z
    .string()
    .min(2, 'Business name must be at least 2 characters.'),
  country: z.string().min(2, 'Please select a country.'),
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
