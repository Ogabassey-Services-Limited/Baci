import { z } from 'zod';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { StorefrontBlogPostSchema } from './storefront-blog-post-schema';
import { StorefrontPublishedConfigSchema } from './storefront-published-config-schema';
import { StorefrontSeoPathSchema } from './storefront-seo-path-schema';

const PublicMediaUrlSchema = z
  .string()
  .min(1)
  .max(2_048)
  .refine(
    isStablePublicMediaUrl,
    'Expected a stable public HTTPS URL or root-relative path without query parameters'
  );

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
  publishedStatus: z.literal('published'),
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

const VariantAttributesSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(64)
      .refine((value) => value.trim() === value),
    z
      .string()
      .min(1)
      .max(160)
      .refine((value) => value.trim() === value)
  )
  .superRefine((attributes, context) => {
    if (Object.keys(attributes).length > 32)
      context.addIssue({
        code: 'custom',
        message: 'Variant attributes must contain at most 32 entries',
      });
  });

const ProductVariantSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(128).optional(),
  priceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mediaIds: z.array(z.uuid()).max(32).optional(),
  available: z.boolean(),
  attributes: VariantAttributesSchema.optional(),
  condition: z
    .enum(['new', 'used', 'open_box', 'refurbished'])
    .nullable()
    .optional(),
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
  publishedAt: z.iso.datetime({ offset: true }).optional(),
});

const SeoEntrySchema = z.strictObject({
  path: StorefrontSeoPathSchema,
  title: z.string().trim().min(1).max(240),
  description: z.string().max(500).optional(),
  imageMediaId: z.uuid().optional(),
  indexable: z.boolean(),
});

/** Strict public-only DTO consumed by the deterministic storefront renderer. */
export const StorefrontPublicProjectionPayloadSchema = z
  .strictObject({
    merchant: MerchantSchema,
    publishedConfig: StorefrontPublishedConfigSchema,
    products: z.array(ProductSchema).max(10_000),
    categories: z.array(CategorySchema).max(2_000).optional(),
    media: z.array(MediaSchema).max(20_000).optional(),
    contentPages: z.array(ContentPageSchema).max(2_000).optional(),
    blogPosts: z.array(StorefrontBlogPostSchema).max(10_000).optional(),
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
  })
  .superRefine((payload, context) => {
    const categoryIds = new Set(
      (payload.categories ?? []).map((category) => category.id)
    );
    for (const [productIndex, product] of payload.products.entries())
      for (const [categoryIndex, categoryId] of (
        product.categoryIds ?? []
      ).entries())
        if (!categoryIds.has(categoryId))
          context.addIssue({
            code: 'custom',
            message:
              'Category reference does not resolve to payload.categories',
            path: ['products', productIndex, 'categoryIds', categoryIndex],
          });
    for (const [categoryIndex, category] of (
      payload.categories ?? []
    ).entries())
      if (category.parentId && !categoryIds.has(category.parentId))
        context.addIssue({
          code: 'custom',
          message: 'Category reference does not resolve to payload.categories',
          path: ['categories', categoryIndex, 'parentId'],
        });

    const mediaIds = new Set<string>();
    for (const [index, media] of (payload.media ?? []).entries()) {
      if (mediaIds.has(media.id))
        context.addIssue({
          code: 'custom',
          message: 'Media IDs must be unique',
          path: ['media', index, 'id'],
        });
      mediaIds.add(media.id);
    }

    const references: Array<
      readonly [string | undefined | null, PropertyKey[]]
    > = [
      [
        payload.merchant.brandTokens?.logoMediaId,
        ['merchant', 'brandTokens', 'logoMediaId'],
      ],
      [
        payload.merchant.brandTokens?.faviconMediaId,
        ['merchant', 'brandTokens', 'faviconMediaId'],
      ],
    ];
    for (const [productIndex, product] of payload.products.entries()) {
      for (const [mediaIndex, mediaId] of (product.mediaIds ?? []).entries())
        references.push([
          mediaId,
          ['products', productIndex, 'mediaIds', mediaIndex],
        ]);
      for (const [variantIndex, variant] of (product.variants ?? []).entries())
        for (const [mediaIndex, mediaId] of (variant.mediaIds ?? []).entries())
          references.push([
            mediaId,
            [
              'products',
              productIndex,
              'variants',
              variantIndex,
              'mediaIds',
              mediaIndex,
            ],
          ]);
    }
    for (const [categoryIndex, category] of (
      payload.categories ?? []
    ).entries())
      references.push([
        category.mediaId,
        ['categories', categoryIndex, 'mediaId'],
      ]);
    for (const [seoIndex, seoEntry] of (payload.seoEntries ?? []).entries())
      references.push([
        seoEntry.imageMediaId,
        ['seoEntries', seoIndex, 'imageMediaId'],
      ]);

    for (const [mediaId, path] of references)
      if (mediaId && !mediaIds.has(mediaId))
        context.addIssue({
          code: 'custom',
          message: 'Media reference does not resolve to payload.media',
          path,
        });
  });

export type StorefrontPublicProjectionPayload = z.infer<
  typeof StorefrontPublicProjectionPayloadSchema
>;
