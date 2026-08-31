import { z } from 'zod';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { StorefrontPublicContentPageSchema } from './public-projection-content-page-schema';
import { StorefrontPublicMerchantSchema } from './public-projection-merchant-schema';
import { StorefrontPublicPoliciesSchema } from './public-projection-policies-schema';
import { StorefrontPublicProductSchema } from './public-projection-product-schema';
import { STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS } from './reserved-category-slugs';
import { StorefrontBlogPostSchema } from './storefront-blog-post-schema';
import { StorefrontPublishedConfigSchema } from './storefront-published-config-schema';
import { StorefrontSeoPathSchema } from './storefront-seo-path-schema';
import { validatePublicProjectionCategoryHierarchy } from './validate-public-projection-category-hierarchy';
import { validatePublicProjectionIdentities } from './validate-public-projection-identities';
import { validatePublicProjectionSeoEntries } from './validate-public-projection-seo-entries';

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
const CategorySeoFaqSchema = z.strictObject({
  question: z.string().trim().min(1).max(500),
  answer: z
    .string()
    .min(1)
    .max(5_000)
    .refine(
      (answer) => !hasUnstableBlogContentMedia(answer),
      'Category FAQ answers links and media must be release-safe'
    ),
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
  seoHeading: z.string().trim().min(1).max(240).nullable().optional(),
  seoDescription: z.string().max(2_000).nullable().optional(),
  seoFeatures: z
    .array(z.string().trim().min(1).max(500))
    .max(32)
    .nullable()
    .optional(),
  seoFaq: z.array(CategorySeoFaqSchema).max(64).nullable().optional(),
});

const MediaSchema = z.strictObject({
  id: z.uuid(),
  publicUrl: PublicMediaUrlSchema,
  alt: z.string().max(500),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
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
    merchant: StorefrontPublicMerchantSchema,
    publishedConfig: StorefrontPublishedConfigSchema,
    products: z.array(StorefrontPublicProductSchema).max(10_000),
    categories: z.array(CategorySchema).max(2_000).optional(),
    media: z.array(MediaSchema).max(20_000).optional(),
    contentPages: z
      .array(StorefrontPublicContentPageSchema)
      .max(2_000)
      .optional(),
    blogPosts: z.array(StorefrontBlogPostSchema).max(10_000).optional(),
    policies: StorefrontPublicPoliciesSchema.optional(),
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
    for (const [productIndex, product] of payload.products.entries())
      if (product.currency !== payload.merchant.currency)
        context.addIssue({
          code: 'custom',
          message: 'Product currency must match merchant currency',
          path: ['products', productIndex, 'currency'],
        });
    if (
      (payload.blogPosts?.length ?? 0) > 0 &&
      !payload.featureFlags?.some(
        (flag) => flag.key === 'blog_enabled' && flag.enabled
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Published blog posts require the blog feature to be enabled',
        path: ['blogPosts'],
      });
    const policyPageSlugs = {
      privacy: new Set<string>(['privacy', 'privacy-policy']),
      returns: new Set<string>(['returns']),
      shipping: new Set<string>(['shipping']),
      terms: new Set<string>([
        'terms',
        'terms-and-conditions',
        'terms-of-service',
      ]),
    } as const;
    for (const [policyKey, slugs] of Object.entries(policyPageSlugs)) {
      const policyBody =
        payload.policies?.[policyKey as keyof typeof policyPageSlugs];
      if (policyBody === undefined) continue;
      for (const [pageIndex, page] of (payload.contentPages ?? []).entries())
        if (slugs.has(page.slug) && page.body !== policyBody)
          context.addIssue({
            code: 'custom',
            message: 'Policy and content-page sources must agree',
            path: ['contentPages', pageIndex, 'body'],
          });
    }
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
    for (const [productIndex, product] of payload.products.entries())
      if (
        product.primaryCategoryId &&
        !categoryIds.has(product.primaryCategoryId)
      )
        context.addIssue({
          code: 'custom',
          message:
            'Primary category reference does not resolve to payload.categories',
          path: ['products', productIndex, 'primaryCategoryId'],
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

    validatePublicProjectionCategoryHierarchy(
      payload.categories ?? [],
      context
    );
    validatePublicProjectionSeoEntries(payload, context);

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
      for (const [galleryIndex, gallery] of (
        product.colorGalleries ?? []
      ).entries())
        for (const [mediaIndex, mediaId] of gallery.mediaIds.entries())
          references.push([
            mediaId,
            [
              'products',
              productIndex,
              'colorGalleries',
              galleryIndex,
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
