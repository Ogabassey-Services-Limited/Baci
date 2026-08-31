import { z } from 'zod';
import { normalizeProductSelectionParamKey } from '../lib/normalize-product-selection-param-key';
import type { CanonicalProductCondition } from '../lib/product-condition';
import { normalizeCanonicalProductCondition } from '../lib/product-condition';
import { compareCodePointStrings } from './compare-code-point-strings';

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
        .sort(([left], [right]) => compareCodePointStrings(left, right))
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

/** Product condition, variant, and price schemas shared by the public product schema. */
export const StorefrontPublicProductSubschemas = {
  availableConditions: AvailableConditionsSchema,
  condition: ProductConditionSchema,
  conditionOffer: ProductConditionOfferSchema,
  optionalCompareAtPrice: OptionalCompareAtPriceSchema,
  variant: ProductVariantSchema,
} as const;
