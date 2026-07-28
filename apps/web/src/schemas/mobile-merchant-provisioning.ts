import { MERCHANT_COUNTRIES } from '@baci/shared/constants';
import z from 'zod';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import { sanitizePhone, sanitizeText, sanitizeUrl } from '@/lib/sanitize-core';
import { brandColorsSchema } from '@/schemas/brand-colors';

const merchantCountryCodes = MERCHANT_COUNTRIES.map(
  ({ code }) => code
) as unknown as readonly [string, ...string[]];

const sanitizedText = (value: unknown) =>
  typeof value === 'string' ? sanitizeText(value) : value;

const sanitizedPhone = (value: unknown) =>
  typeof value === 'string'
    ? sanitizePhone(sanitizeText(value)) || undefined
    : value;

const sanitizedBusinessName = (value: unknown) =>
  typeof value === 'string'
    ? normalizeBusinessName(sanitizeText(value))
    : value;

const sanitizedOptionalUrl = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return undefined;
  }
  return sanitizeUrl(trimmed) || '__invalid_url__';
};

const boundedBrandColorsSchema = brandColorsSchema.refine(
  (colors) => Object.values(colors).every((value) => value.length <= 64),
  { message: 'Brand color values must be at most 64 characters.' }
);

export const mobileMerchantProvisioningSchema = z
  .object({
    firstName: z.preprocess(sanitizedText, z.string().trim().min(1).max(100)),
    lastName: z.preprocess(sanitizedText, z.string().trim().min(1).max(100)),
    phone: z.preprocess(sanitizedPhone, z.string().trim().max(32).optional()),
    businessName: z.preprocess(
      sanitizedBusinessName,
      z.string().min(2).max(200)
    ),
    businessType: z.preprocess(
      sanitizedText,
      z.string().trim().min(1).max(100)
    ),
    otherBusinessType: z.preprocess(
      sanitizedText,
      z.string().trim().min(2).max(100).optional()
    ),
    country: z.enum(merchantCountryCodes),
    slug: z.preprocess(
      (value) =>
        typeof value === 'string'
          ? sanitizeText(value).toLowerCase() || undefined
          : value,
      z
        .string()
        .min(3)
        .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
        .optional()
    ),
    slugIsCustom: z.boolean(),
    logoUrl: z.preprocess(
      sanitizedOptionalUrl,
      z.string().max(2048).url().optional()
    ),
    brandColors: boundedBrandColorsSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.businessType === 'other' && !value.otherBusinessType) {
      context.addIssue({
        code: 'custom',
        message: 'Please specify your business type.',
        path: ['otherBusinessType'],
      });
    }
    if (value.slugIsCustom && !value.slug) {
      context.addIssue({
        code: 'custom',
        message: 'Please choose a store link.',
        path: ['slug'],
      });
    }
    if (value.slugIsCustom && value.slug && value.slug.length > 63) {
      context.addIssue({
        code: 'custom',
        message: 'Store link must be at most 63 characters.',
        path: ['slug'],
      });
    }
  });

export type MobileMerchantProvisioningInput = z.infer<
  typeof mobileMerchantProvisioningSchema
>;
