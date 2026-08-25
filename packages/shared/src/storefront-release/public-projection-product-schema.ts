import { z } from 'zod';
import type { CanonicalProductCondition } from '../lib/product-condition';
import { normalizeCanonicalProductCondition } from '../lib/product-condition';
import { normalizeProductSelectionParamKey } from '../lib/product-selection-params';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';
import { StorefrontPublicProductSpecificationFieldsSchema } from './public-projection-product-specification-fields-schema';

const ProductConditionSchema = z
  .enum(['new', 'used', 'open_box', 'refurbished'])
  .transform(
    (condition) =>
      normalizeCanonicalProductCondition(condition) as CanonicalProductCondition
  );

const AvailableConditionsSchema = z
  .array(ProductConditionSchema)
  .max(3)
  .superRefine((conditions, context) => {
    if (new Set(conditions).size !== conditions.length)
      context.addIssue({
        code: 'custom',
        message: 'Available product conditions must be canonically unique',
      });
  })
  .transform((conditions) => [...conditions].sort());

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
    const normalizedKeys = Object.keys(attributes).map(
      normalizeProductSelectionParamKey
    );
    if (Object.keys(attributes).length > 32)
      context.addIssue({
        code: 'custom',
        message: 'Variant attributes must contain at most 32 entries',
      });
    if (normalizedKeys.some((key) => key === 'condition'))
      context.addIssue({
        code: 'custom',
        message: 'Variant condition must use the typed condition field',
      });
    if (new Set(normalizedKeys).size !== normalizedKeys.length)
      context.addIssue({
        code: 'custom',
        message: 'Variant attribute axes must be canonically unique',
      });
  })
  .transform((attributes) =>
    Object.fromEntries(
      Object.entries(attributes)
        .map(
          ([key, value]) =>
            [normalizeProductSelectionParamKey(key), value] as const
        )
        .sort(([left], [right]) => left.localeCompare(right))
    )
  );

const OptionalCompareAtPriceSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable()
  .optional();

const ProductVariantSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(128).optional(),
  priceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  compareAtPriceMinor: OptionalCompareAtPriceSchema,
  mediaIds: z.array(z.uuid()).max(32).optional(),
  available: z.boolean(),
  displayQuantityLimit: z.number().int().nonnegative().max(100).nullable(),
  attributes: VariantAttributesSchema.optional(),
  condition: ProductConditionSchema.nullable().optional(),
});

const ProductConditionOfferSchema = z.strictObject({
  id: z.uuid(),
  condition: ProductConditionSchema,
  priceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  compareAtPriceMinor: OptionalCompareAtPriceSchema,
  displayQuantityLimit: z.number().int().nonnegative().max(100).nullable(),
  available: z.boolean(),
  grade: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
  mediaIds: z.array(z.uuid()).max(32).optional(),
  status: z.literal('active'),
});

/** Bounded public product fields consumed by released listings and PDPs. */
export const StorefrontPublicProductSchema = z
  .strictObject({
    id: z.uuid(),
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(240),
    brand: z.string().trim().min(1).max(160).nullable().optional(),
    sku: z.string().trim().min(1).max(128).nullable().optional(),
    mpn: z.string().trim().min(1).max(128).nullable().optional(),
    description: z
      .string()
      .max(100_000)
      .refine(
        (value) => !hasUnstableBlogContentMedia(value),
        'Product description links and media must be release-safe'
      )
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
    mediaIds: z.array(z.uuid()).max(64).optional(),
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
        .sort(([left], [right]) => left.localeCompare(right));
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
  });
