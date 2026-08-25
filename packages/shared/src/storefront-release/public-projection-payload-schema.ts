import { z } from 'zod';
import type { BuilderData } from '../contracts/builder-ai-edit';
import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isCanonicalPublishedRoot(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    isRecord(value.props) &&
    Object.keys(value.props).length === 1 &&
    typeof value.props.title === 'string' &&
    value.props.title.length <= 120
  );
}
function containsRefusedComponent(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const collections = [value.content];
  if (isRecord(value.zones)) collections.push(...Object.values(value.zones));
  return collections.some(
    (collection) =>
      Array.isArray(collection) &&
      collection.some(
        (component) =>
          isRecord(component) &&
          typeof component.type === 'string' &&
          builderDesignCapabilityAdapter.getCapability(component.type)?.refused
      )
  );
}
const PublishedConfigSchema = z
  .unknown()
  .superRefine((value, context) => {
    const candidate = builderPreviewCandidateConfigSchema.safeParse(value);
    if (!candidate.success) {
      context.addIssue({
        code: 'custom',
        message: 'Expected a bounded render-safe published Puck configuration',
      });
      return;
    }
    if (!isRecord(value) || !isCanonicalPublishedRoot(value.root))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck root must already be canonical',
      });
    if (containsRefusedComponent(value))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck configuration contains a refused component',
      });
  })
  .transform((value) => value as BuilderData);
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
  path: z.string().startsWith('/').max(2_048),
  title: z.string().trim().min(1).max(240),
  description: z.string().max(500).optional(),
  imageMediaId: z.uuid().optional(),
  indexable: z.boolean(),
});

/** Strict public-only DTO consumed by the deterministic storefront renderer. */
export const StorefrontPublicProjectionPayloadSchema = z
  .strictObject({
    merchant: MerchantSchema,
    publishedConfig: PublishedConfigSchema,
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
  })
  .superRefine((payload, context) => {
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
