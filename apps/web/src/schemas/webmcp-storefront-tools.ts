import { z } from 'zod';
import {
  WEBMCP_CATALOG_LIMIT,
  WEBMCP_CATALOG_SORT_VALUES,
  WEBMCP_DEFAULT_CATALOG_LIMIT,
  type WebMcpCatalogSearchInput,
  type WebMcpCatalogSort,
  webMcpCatalogSearchInputJsonSchema,
  webMcpProductLookupInputJsonSchema,
  webMcpStorePoliciesInputJsonSchema,
} from './webmcp-storefront-tools-contract';

export {
  WEBMCP_CATALOG_LIMIT,
  WEBMCP_CATALOG_SORT_VALUES,
  WEBMCP_DEFAULT_CATALOG_LIMIT,
  type WebMcpCatalogSearchInput,
  type WebMcpCatalogSort,
  webMcpCatalogSearchInputJsonSchema,
  webMcpProductLookupInputJsonSchema,
  webMcpStorePoliciesInputJsonSchema,
};

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
