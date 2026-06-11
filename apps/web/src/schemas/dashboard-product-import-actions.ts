import { z } from 'zod';

export const MAX_PRICE_LIST_INPUT_CHARS = 5_000_000;
export const MAX_PRODUCTS_PER_IMPORT = 10_000;
export const MAX_GOOGLE_SHEET_URL_CHARS = 4096;

const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i;
const CSV_HEADER_NAME_PATTERN = /\b(name|prod|item|title|model)\b/i;
const CSV_HEADER_PRICE_PATTERN = /\b(price|cost|amount|naira|ngn)\b/i;

export const ProductImportProductSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  price: z.number().finite().nonnegative(),
  sku: z.string().max(256).nullable().optional(),
  stock: z.number().finite().optional(),
});

export type ValidatedImportProduct = z.infer<typeof ProductImportProductSchema>;

export const ProductImportProductsSchema = z
  .array(ProductImportProductSchema)
  .max(MAX_PRODUCTS_PER_IMPORT);

export const ProcessPriceListInputSchema = z.object({
  currentProducts: ProductImportProductsSchema,
  priceListData: z.string().max(MAX_PRICE_LIST_INPUT_CHARS),
  vendor: z.string().max(100),
  fileType: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => MIME_TYPE_PATTERN.test(value), {
      message: 'Invalid MIME type',
    }),
});

export const ParseCsvDirectlyInputSchema = z.object({
  currentProducts: ProductImportProductsSchema,
  csvData: z
    .string()
    .max(MAX_PRICE_LIST_INPUT_CHARS)
    .refine(hasLikelyCsvHeaders, {
      message: 'CSV must include name and price columns',
    }),
});

export const FetchGoogleSheetInputSchema = z.object({
  url: z.url().max(MAX_GOOGLE_SHEET_URL_CHARS),
});

export const ChangeDetailsSchema = z.object({
  name: z.string(),
  price: z.number(),
  sku: z.string().optional(),
  description: z.string().optional(),
  stock: z.number().optional(),
  brand: z.string().optional(),
  image: z.string().optional().describe('URL of the product image'),
  category: z.string().optional().describe('The product category'),
  attributes: z
    .record(z.string(), z.string())
    .optional()
    .describe('Key-value pairs of product attributes (e.g., RAM, Storage)'),
});

export const ChangeSchema = z.object({
  type: z.enum(['update', 'new', 'remove']),
  productId: z
    .string()
    .optional()
    .describe('SKU or ID of the product to update or remove'),
  newPrice: z
    .number()
    .optional()
    .describe('The new price for a product update'),
  details: ChangeDetailsSchema,
  reason: z
    .string()
    .optional()
    .describe('Reasoning for the change, especially for removals'),
});

export const ClarificationRequestSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()),
  })
  .optional();

export const MissingParameterRequestSchema = z
  .object({
    productName: z.string(),
    missingFields: z.array(z.string()),
  })
  .optional();

export const AIResponseSchema = z.object({
  changes: z.array(ChangeSchema),
  summary: z.string().describe('A human-readable summary of all changes'),
  clarificationRequest: ClarificationRequestSchema,
  missingParameterRequest: MissingParameterRequestSchema,
});

export function hasLikelyCsvHeaders(csvData: string): boolean {
  const lines = csvData.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    return true;
  }

  const headerSearchWindow = lines.slice(0, 10).join('\n');
  return (
    CSV_HEADER_NAME_PATTERN.test(headerSearchWindow) &&
    CSV_HEADER_PRICE_PATTERN.test(headerSearchWindow)
  );
}
