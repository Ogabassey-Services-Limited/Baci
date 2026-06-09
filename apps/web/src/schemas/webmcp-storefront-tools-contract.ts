type JsonObject = Record<string, unknown>;

export const WEBMCP_CATALOG_LIMIT = 50;
export const WEBMCP_DEFAULT_CATALOG_LIMIT = 10;
export const WEBMCP_CATALOG_SORT_VALUES = [
  'newest',
  'price-asc',
  'price-desc',
] as const;

export type WebMcpCatalogSort = (typeof WEBMCP_CATALOG_SORT_VALUES)[number];

export interface WebMcpCatalogSearchInput {
  brand?: string;
  category?: string;
  limit?: number;
  query?: string;
  sort?: WebMcpCatalogSort;
}

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
