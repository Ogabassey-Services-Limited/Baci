import { z } from 'zod';
import { sanitizeText, stripHtmlTags } from '@/lib/sanitize';

export const ProductSchema = z.object({
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
});

// The type the form uses
export type ProductFormValues = z.infer<typeof ProductSchema>;

// The type the database expects (after transformation)
// attributes are reduced to a record
export const ProductDbSchema = ProductSchema.transform((data) => {
  const { variant_attributes, ...rest } = data;

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

  return {
    ...rest,
    variant_attributes: attributesRecord,
    // Ensure category_id is null if empty string
    category_id: rest.category_id === '' ? null : rest.category_id,
  };
});
