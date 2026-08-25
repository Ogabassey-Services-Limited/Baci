import { z } from 'zod';
import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { StorefrontPublicProductSchema } from './public-projection-product-schema';
import { STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS } from './reserved-category-slugs';
import { StorefrontBlogPostSchema } from './storefront-blog-post-schema';
import { StorefrontPublishedConfigSchema } from './storefront-published-config-schema';
import { StorefrontSeoPathSchema } from './storefront-seo-path-schema';
import { validatePublicProjectionIdentities } from './validate-public-projection-identities';

const PublicMediaUrlSchema = z
  .string()
  .min(1)
  .max(2_048)
  .refine(
    isStablePublicMediaUrl,
    'Expected a content-addressed public release asset path'
  );
const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ThemeColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const PublicContactUrlSchema = z
  .string()
  .max(2_048)
  .refine(
    builderDesignCapabilityAdapter.isSafeUrl,
    'Expected a safe public contact URL'
  )
  .refine((value) => !value.includes('?'), 'Expected a query-free contact URL');
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
const MerchantSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  slug: SlugSchema,
  hostname: z.hostname().optional(),
  publishedStatus: z.literal('published'),
  email: z.email().max(320).optional(),
  phone: z.string().trim().min(1).max(40).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  supportEmail: z.email().max(320).optional(),
  supportPhone: z.string().trim().min(1).max(40).optional(),
  businessHours: BusinessHoursSchema.optional(),
  socialLinks: SocialLinksSchema.optional(),
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

const CategorySchema = z.strictObject({
  id: z.uuid(),
  slug: SlugSchema.refine(
    (slug) => !STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS.has(slug),
    { message: 'Category slug is reserved by a storefront route' }
  ),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(20_000).nullable().optional(),
  status: z.literal('active'),
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
  status: z.literal('published'),
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
    products: z.array(StorefrontPublicProductSchema).max(10_000),
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
    validatePublicProjectionIdentities(payload, context);
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
      for (const [offerIndex, offer] of (
        product.conditionOffers ?? []
      ).entries())
        for (const [mediaIndex, mediaId] of (offer.mediaIds ?? []).entries())
          references.push([
            mediaId,
            [
              'products',
              productIndex,
              'conditionOffers',
              offerIndex,
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
