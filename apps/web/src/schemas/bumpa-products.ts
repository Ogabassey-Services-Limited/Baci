import { z } from 'zod';

const urlSchema = z.url();

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => value === '' || urlSchema.safeParse(value).success, {
    error: 'Must be a valid URL',
  });

const optionalUrlList = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine(
    (value) =>
      value === '' ||
      value
        .split(/[|,]/)
        .every(
          (part) =>
            part.trim() === '' || urlSchema.safeParse(part.trim()).success
        ),
    {
      error: 'Must contain only valid URLs',
    }
  );

export const bumpaProductRowSchema = z.object({
  'Product ID': z.string().trim().min(1),
  'Variant ID': z.string().trim().optional().default(''),
  'Row Type': z.string().trim().optional().default('product'),
  Title: z.string().trim().min(1),
  SKU: z.string().trim().optional().default(''),
  'Variant Name': z.string().trim().optional().default(''),
  Barcode: z.string().trim().optional().default(''),
  Description: z.string().trim().optional().default(''),
  Details: z.string().trim().optional().default(''),
  Unit: z.string().trim().optional().default('pc'),
  Price: z.string().trim().min(1),
  Sales: z.string().trim().optional().default(''),
  Cost: z.string().trim().optional().default(''),
  Stock: z.string().trim().optional().default('0'),
  'Weight (kg)': z.string().trim().optional().default(''),
  Type: z.string().trim().optional().default('simple'),
  Status: z.string().trim().optional().default('0'),
  Featured: z.string().trim().optional().default('0'),
  'Manage Stock': z.string().trim().optional().default('1'),
  'Sales Count': z.string().trim().optional().default('0'),
  'Ratings Cache': z.string().trim().optional().default(''),
  'Ratings Count': z.string().trim().optional().default('0'),
  'Currency Code': z.string().trim().optional().default('NGN'),
  'Is Demo': z.string().trim().optional().default('0'),
  'Is Active': z.string().trim().optional().default('1'),
  'Min Order Qty': z.string().trim().optional().default('1'),
  'Max Order Qty': z.string().trim().optional().default(''),
  Collections: z.string().trim().optional().default(''),
  'Options Names': z.string().trim().optional().default(''),
  'Options Values': z.string().trim().optional().default(''),
  'Main Image': optionalUrl,
  'Additional Images': optionalUrlList,
  'SEO Title': z.string().trim().optional().default(''),
  'SEO Description': z.string().trim().optional().default(''),
  'Product Type': z.string().trim().optional().default(''),
  Vendor: z.string().trim().optional().default(''),
  Gender: z.string().trim().optional().default(''),
  'Age Group': z.string().trim().optional().default(''),
  Condition: z.string().trim().optional().default('new'),
  'Google Product Category': z.string().trim().optional().default(''),
  'Created At': z.string().trim().optional().default(''),
  'Updated At': z.string().trim().optional().default(''),
  Source: z.string().trim().optional().default(''),
  'Source ID': z.string().trim().optional().default(''),
});

export type BumpaProductRow = z.infer<typeof bumpaProductRowSchema>;
