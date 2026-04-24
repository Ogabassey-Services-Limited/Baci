import {
  getSkuMatrixValidationError,
  inferProductVariantModel,
  normalizeCanonicalProductCondition,
  resolveDefaultVariantSelection,
} from '@baci/shared';
import { z } from 'zod';
import { EDITABLE_PRODUCT_CONDITIONS } from '@/lib/product-condition';
import {
  buildParentVariantAttributes,
  buildVariantAttributeRecord,
  getLowestVariantPrice,
  getTotalVariantStock,
} from '@/lib/product-variant-form';
import { sanitizeText, stripHtmlTags } from '@/lib/sanitize';

const variantAttributeSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const normalizedConditionSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeCanonicalProductCondition(trimmed);
  return normalized || trimmed;
}, z.enum(EDITABLE_PRODUCT_CONDITIONS).optional().nullable());

function isEditableCondition(
  value: string
): value is (typeof EDITABLE_PRODUCT_CONDITIONS)[number] {
  return EDITABLE_PRODUCT_CONDITIONS.includes(
    value as (typeof EDITABLE_PRODUCT_CONDITIONS)[number]
  );
}

const productVariantSchema = z.object({
  attributes: z.array(variantAttributeSchema).default([]),
  condition: normalizedConditionSchema,
  cost_price: z.number().min(0).optional().default(0),
  id: z.string().uuid().optional(),
  images: z.array(z.string()).default([]),
  price: z.number().min(0),
  primary_image: z.string().nullable().optional(),
  sku: z.string().optional().default(''),
  stock_quantity: z.number().int().min(0).optional().default(0),
});

export const ProductSchema = z
  .object({
    // Sanitize name to prevent XSS - strip all HTML
    name: z
      .string()
      .min(1, 'Product name is required')
      .transform((val) => sanitizeText(val, 200)),
    brand: z
      .string()
      .optional()
      .transform((val) => (val ? sanitizeText(val, 200) : val)),
    sku: z.string().min(1, 'SKU is required'),
    price: z.number().min(0),
    cost_price: z.number().min(0).optional().default(0),
    stock_quantity: z.number().int().min(0),
    low_stock_threshold: z.number().int().min(0).optional(),
    // Sanitize description to prevent XSS - strip HTML tags
    description: z
      .string()
      .optional()
      .transform((val) => (val ? stripHtmlTags(val) : val)),
    // We only care about category_id for the database
    category_id: z
      .string()
      .uuid('Invalid Category ID')
      .optional()
      .or(z.literal('')),
    color: z.string().optional(),
    condition: normalizedConditionSchema.refine(
      (value) => value == null || isEditableCondition(value),
      {
        message: 'Condition must be a supported editable condition.',
      }
    ),
    manage_stock: z.boolean().default(true),
    status: z.enum(['active', 'draft', 'archived']).default('active'),
    images: z.array(z.string()).default([]),
    has_variants: z.boolean().default(false),

    // Frontend uses array of {key, value}, DB uses JSONB Record<string, any>
    // We accept the frontend format in the input, but transform it for the output
    variant_attributes: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      )
      .optional()
      .default([]),

    fulfillment_details: z
      .object({
        items: z
          .array(
            z.object({
              imei: z.string().optional(),
              serial_number: z.string().optional(),
            })
          )
          .optional(),
      })
      .optional(),
    variants: z.array(productVariantSchema).default([]),
  })
  .superRefine((data, context) => {
    if (!data.has_variants) {
      return;
    }

    if (data.variants.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one variant before saving.',
        path: ['variants'],
      });
      return;
    }

    const seenSignatures = new Set<string>();
    const variantModel = inferProductVariantModel({
      variants: data.variants.map((variant) => ({
        condition: variant.condition,
        price_override: variant.price,
      })),
    });
    const skuMatrixValidationError = getSkuMatrixValidationError({
      hasVariants: data.has_variants,
      variantModel,
      variants: data.variants.map((variant) => ({
        condition: variant.condition,
        price_override: variant.price,
      })),
    });

    if (skuMatrixValidationError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: skuMatrixValidationError,
        path: ['variants'],
      });
    }

    for (const [variantIndex, variant] of data.variants.entries()) {
      const normalizedCondition = variant.condition?.trim().toLowerCase() ?? '';
      const normalizedKeys = variant.attributes
        .map((attribute) => attribute.key.trim().toLowerCase())
        .filter(Boolean);

      if (normalizedKeys.length === 0 && !normalizedCondition) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each variant needs at least one attribute or condition.',
          path: ['variants', variantIndex],
        });
      }

      if (new Set(normalizedKeys).size < normalizedKeys.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each variant attribute key must be unique.',
          path: ['variants', variantIndex, 'attributes'],
        });
      }

      const signature = Object.entries(
        buildVariantAttributeRecord(variant.attributes)
      )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key.toLowerCase()}:${value.toLowerCase()}`)
        .join('|');
      const variantKey = `condition:${normalizedCondition}|${signature}`;

      if (!variantKey.replace('condition:|', '')) {
        continue;
      }

      if (seenSignatures.has(variantKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate variants must be merged or changed.',
          path: ['variants', variantIndex, 'attributes'],
        });
      }

      seenSignatures.add(variantKey);
    }
  });

// The type the form uses
export type ProductFormValues = z.infer<typeof ProductSchema>;

// The type the database expects (after transformation)
// attributes are reduced to a record
export const ProductDbSchema = ProductSchema.transform((data) => {
  const { has_variants, variant_attributes, variants, ...rest } = data;

  const attributesRecord =
    variant_attributes?.reduce(
      (acc, curr) => {
        if (curr.key.trim()) {
          acc[curr.key.trim()] = curr.value.trim();
        }
        return acc;
      },
      {} as Record<string, string>
    ) || {};

  const normalizedVariants = variants.map((variant) => ({
    attributes: buildVariantAttributeRecord(variant.attributes),
    condition: variant.condition ?? null,
    cost_price: variant.cost_price ?? null,
    id: variant.id,
    images: variant.images,
    primary_image: variant.primary_image || null,
    price_override: variant.price,
    sku: variant.sku.trim() || null,
    stock_quantity: variant.stock_quantity,
  }));
  const persistedVariants = has_variants ? normalizedVariants : [];

  const variantModel = inferProductVariantModel({
    variants: persistedVariants,
  });
  const defaultSelectionVariants = persistedVariants.map((variant, index) => ({
    ...variant,
    id: variant.id ?? `draft-variant-${index}`,
  }));
  const defaultSelection =
    variantModel === 'sku_matrix'
      ? resolveDefaultVariantSelection({
          price: rest.price,
          manage_stock: rest.manage_stock,
          variants: defaultSelectionVariants,
        })
      : null;
  const nextPrice =
    variantModel === 'sku_matrix'
      ? (defaultSelection?.price ?? rest.price)
      : has_variants
        ? getLowestVariantPrice(variants, rest.price)
        : rest.price;
  const nextStock =
    variantModel === 'sku_matrix'
      ? (defaultSelection?.variant.stock_quantity ?? 0)
      : has_variants
        ? getTotalVariantStock(variants)
        : rest.stock_quantity;
  const nextCondition =
    variantModel === 'sku_matrix'
      ? (defaultSelection?.condition ?? persistedVariants[0]?.condition ?? null)
      : (rest.condition ?? null);
  const nextColor = has_variants
    ? (defaultSelection?.color ??
      persistedVariants
        .map((variant) => variant.attributes.color?.trim())
        .find((value): value is string => Boolean(value)) ??
      null)
    : rest.color?.trim() || null;

  return {
    ...rest,
    color: nextColor,
    condition: nextCondition,
    has_variants,
    // Force managed stock whenever the product exposes variants. Without this
    // override, toggling `has_variants` on after creating the product as an
    // unmanaged-stock listing would carry the stale `manage_stock=false` flag
    // forward and cause variant stock counts to be ignored.
    manage_stock: has_variants ? true : rest.manage_stock,
    price: nextPrice,
    stock: nextStock,
    stock_quantity: nextStock,
    variant_model: variantModel,
    ...(variantModel === 'sku_matrix'
      ? { migration_status: 'migrated' as const }
      : {}),
    variant_attributes: has_variants
      ? buildParentVariantAttributes(variants)
      : attributesRecord,
    variants: persistedVariants,
    // Ensure category_id is null if empty string
    category_id: rest.category_id === '' ? null : rest.category_id,
  };
});
