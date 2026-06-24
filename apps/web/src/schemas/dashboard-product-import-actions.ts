import { z } from 'zod';

export const MAX_PRICE_LIST_INPUT_CHARS = 5_000_000;
export const MAX_PRODUCTS_PER_IMPORT = 10_000;
export const MAX_GOOGLE_SHEET_URL_CHARS = 4096;

const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i;
const LEGACY_PRICE_LIST_FILE_TYPES: Record<string, string> = {
  csv: 'text/csv',
  text: 'text/plain',
};

const ProductImportProductSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  price: z.number().finite().nonnegative(),
  cost_price: z.number().finite().nonnegative().nullable().optional(),
  sku: z.string().max(256).nullable().optional(),
  stock: z.number().finite().nonnegative().optional(),
});

export type ValidatedImportProduct = z.infer<typeof ProductImportProductSchema>;

const ProductImportProductsSchema = z
  .array(ProductImportProductSchema)
  .max(MAX_PRODUCTS_PER_IMPORT);

function isGoogleSheetsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['docs.google.com', 'sheets.google.com'].includes(url.hostname) &&
      url.pathname.includes('/spreadsheets/')
    );
  } catch {
    return false;
  }
}

function normalizePriceListFileType(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  return LEGACY_PRICE_LIST_FILE_TYPES[normalized] ?? normalized;
}

export const ProcessPriceListInputSchema = z.object({
  currentProducts: ProductImportProductsSchema,
  priceListData: z.string().max(MAX_PRICE_LIST_INPUT_CHARS),
  vendor: z.string().max(100),
  fileType: z.preprocess(
    normalizePriceListFileType,
    z
      .string()
      .min(1)
      .max(100)
      .refine((value) => MIME_TYPE_PATTERN.test(value), {
        message: 'Invalid MIME type',
      })
  ),
});

export const ParseCsvDirectlyInputSchema = z.object({
  currentProducts: ProductImportProductsSchema,
  csvData: z
    .string()
    .max(MAX_PRICE_LIST_INPUT_CHARS)
    .refine((value) => value.trim().length > 0, {
      message: 'CSV payload is required',
    }),
});

export const FetchGoogleSheetInputSchema = z.object({
  url: z.url().max(MAX_GOOGLE_SHEET_URL_CHARS).refine(isGoogleSheetsUrl, {
    message: 'URL must be a Google Sheets URL',
  }),
});

const SharedChangeDetailsShape = {
  name: z.string(),
  price: z.number().finite().nonnegative(),
  cost_price: z.number().finite().nonnegative().nullable().optional(),
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
};

const ChangeDetailsSchema = z.object({
  ...SharedChangeDetailsShape,
  cost_price_was_edited: z.boolean().optional(),
});

const AIChangeDetailsSchema = z.strictObject(SharedChangeDetailsShape);

export const ChangeSchema = z.object({
  type: z.enum(['update', 'new', 'remove']),
  productId: z
    .string()
    .optional()
    .describe('SKU or ID of the product to update or remove'),
  newPrice: z
    .number()
    .finite()
    .nonnegative()
    .optional()
    .describe('The new price for a product update'),
  details: ChangeDetailsSchema,
  reason: z
    .string()
    .optional()
    .describe('Reasoning for the change, especially for removals'),
});

export const BulkUpdateChangesSchema = z.object({
  changes: z.array(ChangeSchema),
});

const ClarificationRequestSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()),
  })
  .optional();

const MissingParameterRequestSchema = z
  .object({
    productName: z.string(),
    missingFields: z.array(z.string()),
  })
  .optional();

const AIChangeSchema = z.strictObject({
  type: z.enum(['update', 'new', 'remove']),
  productId: z
    .string()
    .optional()
    .describe('SKU or ID of the product to update or remove'),
  newPrice: z
    .number()
    .finite()
    .nonnegative()
    .optional()
    .describe('The new price for a product update'),
  details: AIChangeDetailsSchema,
  reason: z
    .string()
    .optional()
    .describe('Reasoning for the change, especially for removals'),
});

export const AIResponseSchema = z.strictObject({
  changes: z.array(AIChangeSchema),
  summary: z.string().describe('A human-readable summary of all changes'),
  clarificationRequest: ClarificationRequestSchema,
  missingParameterRequest: MissingParameterRequestSchema,
});
