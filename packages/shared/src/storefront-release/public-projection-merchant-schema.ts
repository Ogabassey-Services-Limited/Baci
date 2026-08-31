import { z } from 'zod';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';

const PublicContactUrlSchema = z
  .string()
  .max(2_048)
  .refine(isSafePublicReleaseUrl, 'Expected a query-free public contact URL');
const BusinessHoursSchema = z.strictObject({
  monday: z.string().trim().min(1).max(100).optional(),
  tuesday: z.string().trim().min(1).max(100).optional(),
  wednesday: z.string().trim().min(1).max(100).optional(),
  thursday: z.string().trim().min(1).max(100).optional(),
  friday: z.string().trim().min(1).max(100).optional(),
  saturday: z.string().trim().min(1).max(100).optional(),
  sunday: z.string().trim().min(1).max(100).optional(),
});
const SocialLinksSchema = z.strictObject({
  facebook: PublicContactUrlSchema.optional(),
  instagram: PublicContactUrlSchema.optional(),
  linkedin: PublicContactUrlSchema.optional(),
  snapchat: PublicContactUrlSchema.optional(),
  tiktok: PublicContactUrlSchema.optional(),
  twitter: PublicContactUrlSchema.optional(),
  whatsapp: PublicContactUrlSchema.optional(),
  youtube: PublicContactUrlSchema.optional(),
});
const ThemeColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Public merchant identity, routing, localization, and presentation fields. */
export const StorefrontPublicMerchantSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  hostname: z
    .hostname()
    .refine(
      (hostname) => hostname === hostname.toLowerCase(),
      'Expected a canonical lowercase hostname'
    )
    .refine(
      (hostname) => !hostname.endsWith('.'),
      'Expected a hostname without a trailing dot'
    )
    .refine(
      (hostname) => isSafePublicReleaseUrl(`https://${hostname}`),
      'Expected a public publication hostname'
    ),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/),
  locale: z
    .string()
    .min(2)
    .max(35)
    .regex(/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/),
  publishedStatus: z.literal('published'),
  template: z.strictObject({
    id: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    contractVersion: z
      .string()
      .min(2)
      .max(32)
      .regex(/^v[1-9][0-9]*$/),
  }),
  businessType: z.string().trim().min(1).max(100).nullable().optional(),
  email: z.email().max(320).optional(),
  phone: z.string().trim().min(1).max(40).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  supportEmail: z.email().max(320).optional(),
  supportPhone: z.string().trim().min(1).max(40).optional(),
  businessHours: BusinessHoursSchema.optional(),
  socialLinks: SocialLinksSchema.optional(),
  analytics: z
    .strictObject({
      googleAnalyticsId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[\w.-]+$/)
        .nullable()
        .optional(),
      facebookPixelId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[\w.-]+$/)
        .nullable()
        .optional(),
      tiktokPixelId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[\w.-]+$/)
        .nullable()
        .optional(),
      snapchatPixelId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[\w.-]+$/)
        .nullable()
        .optional(),
      twitterPixelId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[\w.-]+$/)
        .nullable()
        .optional(),
      googleStoreWidget: z
        .strictObject({
          enabled: z.boolean(),
          merchantCenterId: z.string().min(1).max(32).regex(/^\d+$/).nullable(),
        })
        .optional(),
    })
    .optional(),
  brandTokens: z
    .strictObject({
      logoMediaId: z.uuid().nullable().optional(),
      faviconMediaId: z.uuid().nullable().optional(),
    })
    .optional(),
  themeTokens: z
    .strictObject({
      primaryColor: ThemeColorSchema.optional(),
      secondaryColor: ThemeColorSchema.optional(),
      accentColor: ThemeColorSchema.optional(),
      backgroundColor: ThemeColorSchema.optional(),
      textColor: ThemeColorSchema.optional(),
    })
    .optional(),
});
