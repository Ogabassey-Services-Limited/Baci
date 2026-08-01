import type { RegisteredAddress } from '@baci/shared';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize-core';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

const socialMediaSchema = z.object({
  twitter: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  facebook: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  instagram: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  tiktok: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  youtube: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  pinterest: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  linkedin: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  snapchat: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
});

export const registeredAddressSchema: z.ZodType<RegisteredAddress> = z.object({
  street: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  city: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  state: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  postal_code: z
    .string()
    .transform((value) => sanitizeText(value, 32))
    .optional()
    .nullable(),
  country: z
    .string()
    .transform((value) => sanitizeText(value, 100))
    .optional()
    .nullable(),
});

const merchantSettingsFieldsSchema = z.object({
  social_media: socialMediaSchema.optional(),
  clear_social_media: z.boolean().optional(),
  vat_registration_status: z
    .enum(['not_registered', 'registered', 'exempt', 'pending'])
    .optional(),
  tax_identification_number: z
    .string()
    .transform((value) => sanitizeText(value, 32))
    .optional()
    .nullable(),
  legal_entity_name: z
    .string()
    .transform((value) => sanitizeText(value, 255))
    .optional()
    .nullable(),
  registered_address: registeredAddressSchema.optional().nullable(),
  state_code: z
    .string()
    .transform((value) => sanitizeText(value, 10))
    .optional()
    .nullable(),
});

export const updateMerchantSettingsSchema = merchantSettingsFieldsSchema.refine(
  (settings) => Object.keys(settings).length > 0,
  {
    error: 'At least one merchant setting must be provided',
  }
);

/** Validated request envelope for merchant-selected settings writes. */
export const merchantSettingsRequestSchema = merchantSettingsFieldsSchema
  .extend({ merchantId: merchantIdParamSchema })
  .refine(
    ({ merchantId: _merchantId, ...settings }) =>
      Object.keys(settings).length > 0,
    { error: 'At least one merchant setting must be provided' }
  );

export function formatMerchantSettingsErrors(
  error: z.ZodError
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}
