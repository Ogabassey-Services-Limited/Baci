/**
 * Product API Validation Schemas (2026 Best Practices)
 *
 * Uses Zod for runtime validation with built-in sanitization transforms.
 * All string fields are sanitized to prevent XSS attacks.
 *
 * @see https://zod.dev for Zod documentation
 */

import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { z } from 'zod';
import { sanitizePrice, sanitizeText, sanitizeUrl } from '@/lib/sanitize-core';

/**
 * Image schema for product images array
 * Matches ProductImage interface from @/lib/products
 */
const productImageSchema = z.object({
  url: z.string().transform((val) => sanitizeUrl(val) || ''),
  alt: z
    .string()
    .max(500)
    .default('')
    .transform((val) => sanitizeText(val, 500)),
  order: z.number().int().min(0).default(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/**
 * Variant attributes schema
 */
const variantAttributesSchema = z.record(
  z.string(),
  z.string().transform((val) => sanitizeText(val, 100))
);

/**
 * Product condition type
 * Matches Product.condition from @/lib/products
 */
const productConditionSchema = z.enum(['new', 'used', 'open_box']);

const normalizedProductConditionSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return normalizeCanonicalProductCondition(value) || value;
}, productConditionSchema);

const productVariantModelSchema = z.enum(['legacy', 'sku_matrix']);

/**
 * Product variant schema
 */
const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  attributes: variantAttributesSchema.optional(),
  condition: normalizedProductConditionSchema.optional().nullable(),
  price_override: z
    .number()
    .min(0)
    .transform((val) => sanitizePrice(val))
    .optional()
    .nullable(),
  cost_price: z
    .number()
    .min(0)
    .transform((val) => sanitizePrice(val))
    .optional()
    .nullable(),
  stock_quantity: z.number().int().min(0).optional().default(0),
  sku: z
    .string()
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 50) : undefined)),
  primary_image: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeUrl(val) : undefined)),
  images: z.array(productImageSchema).optional(),
});

function withSkuMatrixVariantConditionValidation<
  TSchema extends z.ZodObject<z.ZodRawShape>,
>(schema: TSchema) {
  return schema.superRefine((data, ctx) => {
    const parsed = data as {
      variant_model?: 'legacy' | 'sku_matrix';
      variants?: Array<{ condition?: string | null }> | undefined;
    };

    if (parsed.variant_model !== 'sku_matrix') {
      return;
    }

    const hasMissingCondition = (parsed.variants ?? []).some(
      (variant) => variant.condition == null
    );

    if (hasMissingCondition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'sku_matrix products require every variant to include a condition.',
        path: ['variants'],
      });
    }
  });
}

/**
 * Fulfillment details schema
 */
const fulfillmentDetailsSchema = z.object({
  type: z.enum(['ship', 'pickup', 'digital']).optional(),
  handling_time: z.number().int().min(0).optional(),
  free_shipping: z.boolean().optional(),
  shipping_notes: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 500) : undefined)),
});

const productFulfillmentDetailsSchema = z.preprocess((value) => {
  // Legacy dashboard clients still send inventory identifier rows here as an
  // array of { key, value }. Product fulfillment metadata is object-shaped, so
  // ignore that stale payload instead of rejecting the whole product request.
  if (Array.isArray(value)) {
    return undefined;
  }

  return value;
}, fulfillmentDetailsSchema.optional());

const optionalSanitizedUrlSchema = z.preprocess(
  (value) => {
    if (value == null) {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .transform((val) => sanitizeUrl(val) || undefined)
    .optional()
);

/**
 * Dimensions schema
 */
const dimensionsSchema = z.object({
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  unit: z.enum(['cm', 'in', 'm']).optional().default('cm'),
});

/**
 * Product status type
 */
const productStatusSchema = z.enum(['draft', 'active', 'archived']);

/**
 * Base product fields shared between create and update
 */
const baseProductFields = {
  // Core fields
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(200)
    .transform((val) => sanitizeText(val, 200)),
  description: z
    .string()
    .max(10000)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 10000) : undefined)),
  price: z
    .number()
    .min(0, 'Price must be non-negative')
    .transform((val) => sanitizePrice(val)),

  // Inventory
  stock: z.number().int().min(0).optional().default(0),
  manage_stock: z.boolean().optional().default(true),
  low_stock_threshold: z.number().int().min(0).optional().default(5),

  // Pricing variants
  compare_at_price: z
    .number()
    .min(0)
    .optional()
    .nullable()
    .transform((val) => (val != null ? sanitizePrice(val) : undefined)),
  cost_price: z
    .number()
    .min(0)
    .optional()
    .nullable()
    .transform((val) => (val != null ? sanitizePrice(val) : undefined)),

  // Identifiers
  sku: z
    .string()
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 50) : undefined)),
  slug: z
    .string()
    .max(200)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 200) : undefined)),
  gtin: z
    .string()
    .max(14)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 14) : undefined)),
  mpn: z
    .string()
    .max(70)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 70) : undefined)),

  // Categorization
  category: z
    .string()
    .max(100)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 100) : undefined)),
  brand: z
    .string()
    .max(100)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 100) : undefined)),
  google_product_category: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 500) : undefined)),
  color: z
    .string()
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 50) : undefined)),

  // Condition
  condition: normalizedProductConditionSchema.optional().default('new'),
  condition_detail: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 500) : undefined)),

  // Status
  status: productStatusSchema.optional().default('draft'),

  // Images
  images: z.array(productImageSchema).optional(),
  image: optionalSanitizedUrlSchema,
  imageLarge: optionalSanitizedUrlSchema,
  imageHint: z
    .string()
    .max(200)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 200) : undefined)),

  // Physical attributes
  weight_value: z.number().min(0).optional(),
  weight_unit: z.enum(['g', 'kg', 'oz', 'lb']).optional(),
  dimensions: dimensionsSchema.optional(),

  // Tax
  taxable: z.boolean().optional().default(true),
  tax_code: z
    .string()
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 50) : undefined)),

  // SEO
  meta_title: z
    .string()
    .max(70)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 70) : undefined)),
  meta_description: z
    .string()
    .max(160)
    .optional()
    .transform((val) => (val ? sanitizeText(val, 160) : undefined)),
  keywords: z
    .array(
      z
        .string()
        .max(50)
        .transform((val) => sanitizeText(val, 50))
    )
    .optional(),
  canonical_url: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeUrl(val) : undefined)),
  schema_markup: z.record(z.string(), z.unknown()).optional(),

  // Variants
  has_variants: z.boolean().optional().default(false),
  variants: z.array(productVariantSchema).optional(),
  variant_model: productVariantModelSchema.default('legacy'),

  // Fulfillment
  fulfillment_details: productFulfillmentDetailsSchema,
};

/**
 * Schema for creating a new product (POST)
 * Requires name and price
 */
export const createProductSchema = withSkuMatrixVariantConditionValidation(
  z.object({
    ...baseProductFields,
    name: z
      .string()
      .min(1, 'Product name is required')
      .max(200)
      .transform((val) => sanitizeText(val, 200)),
    price: z
      .number()
      .min(0, 'Price must be non-negative')
      .transform((val) => sanitizePrice(val)),
  })
);

/**
 * Schema for updating a product (PUT/PATCH)
 * All fields are optional to support partial updates
 */
export const updateProductSchema = withSkuMatrixVariantConditionValidation(
  z.object({
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((val) => sanitizeText(val, 200))
      .optional(),
    description: z
      .string()
      .max(10000)
      .transform((val) => sanitizeText(val, 10000))
      .optional()
      .nullable(),
    price: z
      .number()
      .min(0)
      .transform((val) => sanitizePrice(val))
      .optional(),

    // Inventory
    stock: z.number().int().min(0).optional(),
    manage_stock: z.boolean().optional(),
    low_stock_threshold: z.number().int().min(0).optional(),

    // Pricing variants
    compare_at_price: z
      .number()
      .min(0)
      .transform((val) => sanitizePrice(val))
      .optional()
      .nullable(),
    cost_price: z
      .number()
      .min(0)
      .transform((val) => sanitizePrice(val))
      .optional()
      .nullable(),

    // Identifiers
    sku: z
      .string()
      .max(50)
      .transform((val) => sanitizeText(val, 50))
      .optional(),
    slug: z
      .string()
      .max(200)
      .transform((val) => sanitizeText(val, 200))
      .optional(),
    gtin: z
      .string()
      .max(14)
      .transform((val) => sanitizeText(val, 14))
      .optional(),
    mpn: z
      .string()
      .max(70)
      .transform((val) => sanitizeText(val, 70))
      .optional(),

    // Categorization
    category: z
      .string()
      .max(100)
      .transform((val) => sanitizeText(val, 100))
      .optional(),
    brand: z
      .string()
      .max(100)
      .transform((val) => sanitizeText(val, 100))
      .optional(),
    google_product_category: z
      .string()
      .max(500)
      .transform((val) => sanitizeText(val, 500))
      .optional(),
    color: z
      .string()
      .max(50)
      .transform((val) => sanitizeText(val, 50))
      .optional(),

    // Condition
    condition: normalizedProductConditionSchema.optional(),
    condition_detail: z
      .string()
      .max(500)
      .transform((val) => sanitizeText(val, 500))
      .optional()
      .nullable(),

    // Status
    status: productStatusSchema.optional(),

    // Images
    images: z.array(productImageSchema).optional(),
    image: optionalSanitizedUrlSchema,
    imageLarge: optionalSanitizedUrlSchema,
    imageHint: z
      .string()
      .max(200)
      .transform((val) => sanitizeText(val, 200))
      .optional(),

    // Physical attributes
    weight_value: z.number().min(0).optional(),
    weight_unit: z.enum(['g', 'kg', 'oz', 'lb']).optional(),
    dimensions: dimensionsSchema.optional(),

    // Tax
    taxable: z.boolean().optional(),
    tax_code: z
      .string()
      .max(50)
      .transform((val) => sanitizeText(val, 50))
      .optional(),

    // SEO
    meta_title: z
      .string()
      .max(70)
      .transform((val) => sanitizeText(val, 70))
      .optional(),
    meta_description: z
      .string()
      .max(160)
      .transform((val) => sanitizeText(val, 160))
      .optional(),
    keywords: z
      .array(
        z
          .string()
          .max(50)
          .transform((val) => sanitizeText(val, 50))
      )
      .optional(),
    canonical_url: z
      .string()
      .transform((val) => sanitizeUrl(val))
      .optional(),
    schema_markup: z.record(z.string(), z.unknown()).optional(),

    // Variants
    has_variants: z.boolean().optional(),
    variants: z.array(productVariantSchema).optional(),
    variant_model: productVariantModelSchema.optional(),

    // Fulfillment
    fulfillment_details: productFulfillmentDetailsSchema,
  })
);

/**
 * Type inference for create product input
 */
export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Type inference for update product input
 */
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Helper to format Zod errors for API responses
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}
