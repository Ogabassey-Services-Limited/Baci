import { z } from 'zod';
import { builderPreviewCandidateConfigSchema } from '../contracts/builder-preview-candidate-config';

const PublicMediaUrlSchema = z
  .string()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const url = value.startsWith('/')
        ? new URL(value, 'https://storefront.invalid')
        : new URL(value);
      return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        url.search === '' &&
        url.hash === ''
      );
    } catch {
      return false;
    }
  }, 'Expected a stable public HTTPS URL or root-relative path without query parameters');

const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const ThemeColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const MerchantSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  slug: SlugSchema,
  hostname: z.hostname().optional(),
  publishedStatus: z.literal('published').optional(),
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

const ProductVariantSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(128).optional(),
  priceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mediaIds: z.array(z.uuid()).max(32).optional(),
  available: z.boolean(),
});

const ProductSchema = z.strictObject({
  id: z.uuid(),
  slug: SlugSchema,
  name: z.string().trim().min(1).max(240),
  description: z.string().max(100_000).nullable().optional(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  priceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  available: z.boolean(),
  categoryIds: z.array(z.uuid()).max(64).optional(),
  mediaIds: z.array(z.uuid()).max(64).optional(),
  variants: z.array(ProductVariantSchema).max(250).optional(),
});

const CategorySchema = z.strictObject({
  id: z.uuid(),
  slug: SlugSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().max(20_000).nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  mediaId: z.uuid().nullable().optional(),
});

const MediaSchema = z.strictObject({
  id: z.uuid(),
  publicUrl: PublicMediaUrlSchema,
  alt: z.string().max(500),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});

const ContentPageSchema = z.strictObject({
  id: z.uuid(),
  slug: SlugSchema,
  title: z.string().trim().min(1).max(240),
  body: z.string().max(500_000),
  format: z.enum(['plain_text', 'sanitized_markdown']),
  publishedAt: z.iso.datetime().optional(),
});

const SeoEntrySchema = z.strictObject({
  path: z.string().startsWith('/').max(2_048),
  title: z.string().trim().min(1).max(240),
  description: z.string().max(500).optional(),
  imageMediaId: z.uuid().optional(),
  indexable: z.boolean(),
});

/** Strict public-only DTO consumed by the deterministic storefront renderer. */
export const StorefrontPublicProjectionPayloadSchema = z.strictObject({
  merchant: MerchantSchema,
  publishedConfig: builderPreviewCandidateConfigSchema,
  products: z.array(ProductSchema).max(10_000),
  categories: z.array(CategorySchema).max(2_000).optional(),
  media: z.array(MediaSchema).max(20_000).optional(),
  contentPages: z.array(ContentPageSchema).max(2_000).optional(),
  blogPosts: z.array(ContentPageSchema).max(10_000).optional(),
  policies: z
    .strictObject({
      privacy: z.string().max(500_000).optional(),
      terms: z.string().max(500_000).optional(),
      returns: z.string().max(500_000).optional(),
      shipping: z.string().max(500_000).optional(),
    })
    .optional(),
  reviewAggregate: z
    .strictObject({
      count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      average: z.number().min(0).max(5),
    })
    .optional(),
  seoEntries: z.array(SeoEntrySchema).max(20_000).optional(),
  featureFlags: z
    .array(
      z.strictObject({
        key: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z][a-z0-9_]*$/),
        enabled: z.boolean(),
      })
    )
    .max(128)
    .optional(),
});

export type StorefrontPublicProjectionPayload = z.infer<
  typeof StorefrontPublicProjectionPayloadSchema
>;
