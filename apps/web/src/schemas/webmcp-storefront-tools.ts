import { z } from 'zod';

type JsonObject = Record<string, unknown>;

export const WEBMCP_CATALOG_LIMIT = 50;
export const WEBMCP_DEFAULT_CATALOG_LIMIT = 10;
export const WEBMCP_CATALOG_SORT_VALUES = [
  'newest',
  'price-asc',
  'price-desc',
] as const;

const optionalTrimmedStringSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim() : undefined),
    z.string().min(1).optional()
  )
  .catch(undefined);

export const webMcpCatalogSearchInputSchema = z.object({
  query: optionalTrimmedStringSchema,
  category: optionalTrimmedStringSchema,
  brand: optionalTrimmedStringSchema,
  sort: z.enum(WEBMCP_CATALOG_SORT_VALUES).optional().catch(undefined),
  limit: z
    .number()
    .int()
    .min(1)
    .max(WEBMCP_CATALOG_LIMIT)
    .optional()
    .catch(undefined),
});

export const webMcpProductLookupInputSchema = z.object({
  product_id: z.string().trim().min(1),
});

export const webMcpStorePoliciesInputSchema = z.object({}).optional();

export type WebMcpCatalogSearchInput = z.infer<
  typeof webMcpCatalogSearchInputSchema
>;

export const webMcpCatalogSearchInputJsonSchema = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    category: { type: 'string' },
    brand: { type: 'string' },
    sort: {
      type: 'string',
      enum: WEBMCP_CATALOG_SORT_VALUES,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: WEBMCP_CATALOG_LIMIT,
    },
  },
} satisfies JsonObject;

export const webMcpProductLookupInputJsonSchema = {
  type: 'object',
  properties: {
    product_id: { type: 'string' },
  },
  required: ['product_id'],
} satisfies JsonObject;

export const webMcpStorePoliciesInputJsonSchema = {
  type: 'object',
  properties: {},
} satisfies JsonObject;
