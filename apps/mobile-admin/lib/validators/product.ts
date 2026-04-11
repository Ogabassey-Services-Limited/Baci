import { z } from 'zod';
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

const productVariantSchema = z.object({
  attributes: z.array(variantAttributeSchema).default([]),
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

    for (const [variantIndex, variant] of data.variants.entries()) {
      const normalizedKeys = variant.attributes
        .map((attribute) => attribute.key.trim().toLowerCase())
        .filter(Boolean);

      if (normalizedKeys.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each variant needs at least one attribute.',
          path: ['variants', variantIndex, 'attributes'],
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

      if (!signature) {
        continue;
      }

      if (seenSignatures.has(signature)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate variants must be merged or changed.',
          path: ['variants', variantIndex, 'attributes'],
        });
      }

      seenSignatures.add(signature);
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
    cost_price: variant.cost_price || null,
    id: variant.id,
    images: variant.images,
    primary_image: variant.primary_image || null,
    price_override: variant.price,
    sku: variant.sku.trim() || null,
    stock_quantity: variant.stock_quantity,
  }));

  const nextPrice = has_variants
    ? getLowestVariantPrice(variants, rest.price)
    : rest.price;
  const nextStock = has_variants
    ? getTotalVariantStock(variants)
    : rest.stock_quantity;

  return {
    ...rest,
    has_variants,
    manage_stock: has_variants ? true : rest.manage_stock,
    price: nextPrice,
    stock: nextStock,
    stock_quantity: nextStock,
    variant_attributes: has_variants
      ? buildParentVariantAttributes(variants)
      : attributesRecord,
    variants: has_variants ? normalizedVariants : [],
    // Ensure category_id is null if empty string
    category_id: rest.category_id === '' ? null : rest.category_id,
  };
});
