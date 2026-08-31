import { z } from 'zod';
import { normalizeProductSelectionParamKey } from '../lib/normalize-product-selection-param-key';
import type { CanonicalProductCondition } from '../lib/product-condition';
import { normalizeCanonicalProductCondition } from '../lib/product-condition';
import { compareCodePointStrings } from './compare-code-point-strings';
import { isValidPublicProductCanonicalPath } from './is-valid-public-product-canonical-path';
import { StorefrontPublicProductColorGalleriesSchema } from './public-projection-product-color-galleries-schema';
import { StorefrontPublicProductSelectionFieldsSchema } from './public-projection-product-selection-fields-schema';
import { StorefrontPublicProductSpecificationFieldsSchema } from './public-projection-product-specification-fields-schema';
import { StorefrontPublicProductSubschemas } from './public-projection-product-subschemas';
import { STOREFRONT_RELEASE_RESERVED_CATEGORY_PDP_SLUGS } from './reserved-category-pdp-slugs';
import { releaseSafeText } from './release-safe-text-schema';
import { StorefrontSeoPathSchema } from './storefront-seo-path-schema';

const {
  availableConditions: AvailableConditionsSchema,
  condition: ProductConditionSchema,
  conditionOffer: ProductConditionOfferSchema,
  optionalCompareAtPrice: OptionalCompareAtPriceSchema,
  variant: ProductVariantSchema,
} = StorefrontPublicProductSubschemas;

/** Bounded public product fields consumed by released listings and PDPs. */
export const StorefrontPublicProductSchema = z
  .strictObject({
    id: z.uuid(),
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .refine(
        (slug) => !STOREFRONT_RELEASE_RESERVED_CATEGORY_PDP_SLUGS.has(slug),
        { message: 'Product slug is reserved by a category storefront route' }
      ),
    name: z.string().trim().min(1).max(240),
    brand: z.string().trim().min(1).max(160).nullable().optional(),
    sku: z.string().trim().min(1).max(128).nullable().optional(),
    mpn: z.string().trim().min(1).max(128).nullable().optional(),
    gtin: z.string().trim().min(1).max(14).nullable().optional(),
    description: releaseSafeText(100_000, 'Product description')
      .nullable()
      .optional(),
    currency: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/),
    priceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    compareAtPriceMinor: OptionalCompareAtPriceSchema,
    available: z.boolean(),
    displayQuantityLimit: z.number().int().nonnegative().max(100).nullable(),
    status: z.literal('active'),
    condition: ProductConditionSchema.nullable().optional(),
    availableConditions: AvailableConditionsSchema.optional(),
    ...StorefrontPublicProductSelectionFieldsSchema.shape,
    ...StorefrontPublicProductSpecificationFieldsSchema.shape,
    rating: z.number().min(0).max(5).nullable().optional(),
    reviewCount: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    ratingCount: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    categoryIds: z.array(z.uuid()).max(64).optional(),
    primaryCategoryId: z.uuid().nullable().optional(),
    canonicalPath: StorefrontSeoPathSchema.nullable().optional(),
    mediaIds: z.array(z.uuid()).max(64).optional(),
    colorGalleries: StorefrontPublicProductColorGalleriesSchema.optional(),
    createdAt: z.iso.datetime({ offset: true }).optional(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
    variants: z.array(ProductVariantSchema).max(250).optional(),
    hasConditionOffers: z.boolean().optional(),
    conditionOffers: z.array(ProductConditionOfferSchema).max(16).optional(),
  })
  .superRefine((product, context) => {
    if (
      product.compareAtPriceMinor !== null &&
      product.compareAtPriceMinor !== undefined &&
      product.compareAtPriceMinor <= product.priceMinor
    )
      context.addIssue({
        code: 'custom',
        message: 'Compare-at price must exceed the selling price',
        path: ['compareAtPriceMinor'],
      });
    const offers = product.conditionOffers ?? [];
    if (product.hasConditionOffers === true && offers.length === 0)
      context.addIssue({
        code: 'custom',
        message: 'Condition-based products require at least one active offer',
        path: ['conditionOffers'],
      });
    if (offers.length > 0 && product.hasConditionOffers !== true)
      context.addIssue({
        code: 'custom',
        message: 'Condition offers require hasConditionOffers to be true',
        path: ['hasConditionOffers'],
      });
    if (offers.length > 0 && (product.variants?.length ?? 0) > 0)
      context.addIssue({
        code: 'custom',
        message: 'Condition offers and SKU variants are mutually exclusive',
        path: ['conditionOffers'],
      });
    if (product.availableConditions) {
      const representedConditions = new Set<string>();
      if (offers.length > 0) {
        for (const offer of offers)
          representedConditions.add(
            normalizeCanonicalProductCondition(offer.condition)
          );
      } else if ((product.variants?.length ?? 0) > 0) {
        for (const variant of product.variants ?? []) {
          const condition = normalizeCanonicalProductCondition(
            variant.condition ?? product.condition
          );
          if (condition) representedConditions.add(condition);
        }
      } else {
        const condition = normalizeCanonicalProductCondition(product.condition);
        if (condition) representedConditions.add(condition);
      }
      const summaryConditions = new Set(product.availableConditions);
      if (
        representedConditions.size !== summaryConditions.size ||
        [...representedConditions].some(
          (condition) =>
            !summaryConditions.has(condition as CanonicalProductCondition)
        )
      )
        context.addIssue({
          code: 'custom',
          message:
            'Available conditions must match the product selection model',
          path: ['availableConditions'],
        });
    }
    const offerConditions = new Set<string>();
    for (const [offerIndex, offer] of offers.entries()) {
      if (
        offer.compareAtPriceMinor !== null &&
        offer.compareAtPriceMinor !== undefined &&
        offer.compareAtPriceMinor <= offer.priceMinor
      )
        context.addIssue({
          code: 'custom',
          message: 'Compare-at price must exceed the selling price',
          path: ['conditionOffers', offerIndex, 'compareAtPriceMinor'],
        });
      const condition = normalizeCanonicalProductCondition(offer.condition);
      if (offerConditions.has(condition))
        context.addIssue({
          code: 'custom',
          message: 'Condition offer conditions must be unique',
          path: ['conditionOffers', offerIndex, 'condition'],
        });
      offerConditions.add(condition);
    }
    const variantSelections = new Set<string>();
    for (const [variantIndex, variant] of (product.variants ?? []).entries()) {
      if (
        variant.compareAtPriceMinor !== null &&
        variant.compareAtPriceMinor !== undefined &&
        variant.compareAtPriceMinor <= variant.priceMinor
      )
        context.addIssue({
          code: 'custom',
          message: 'Compare-at price must exceed the selling price',
          path: ['variants', variantIndex, 'compareAtPriceMinor'],
        });
      const attributes = Object.entries(variant.attributes ?? {})
        .map(
          ([key, value]) =>
            [normalizeProductSelectionParamKey(key), value] as const
        )
        .sort(([left], [right]) => compareCodePointStrings(left, right));
      if (new Set(attributes.map(([key]) => key)).size !== attributes.length)
        context.addIssue({
          code: 'custom',
          message: 'Variant attribute axes must be canonically unique',
          path: ['variants', variantIndex, 'attributes'],
        });
      const selection = JSON.stringify([
        normalizeCanonicalProductCondition(
          variant.condition ?? product.condition
        ) || null,
        attributes,
      ]);
      if (variantSelections.has(selection))
        context.addIssue({
          code: 'custom',
          message: 'Variant selection tuples must be unique',
          path: ['variants', variantIndex],
        });
      variantSelections.add(selection);
    }
  })
  .refine(
    ({ canonicalPath, slug }) =>
      !canonicalPath || isValidPublicProductCanonicalPath(canonicalPath, slug),
    {
      message: 'Canonical path must resolve to this product PDP',
      path: ['canonicalPath'],
    }
  );
