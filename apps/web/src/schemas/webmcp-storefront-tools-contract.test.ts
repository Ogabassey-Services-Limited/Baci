import { describe, expect, it } from 'vitest';
import {
  WEBMCP_CATALOG_LIMIT,
  WEBMCP_CATALOG_SORT_VALUES,
  webMcpCatalogSearchInputJsonSchema,
  webMcpProductLookupInputJsonSchema,
  webMcpStorePoliciesInputJsonSchema,
} from './webmcp-storefront-tools-contract';

describe('webmcp-storefront-tools-contract', () => {
  it('exports the lightweight JSON contracts without runtime validators', () => {
    expect(WEBMCP_CATALOG_SORT_VALUES).toEqual([
      'newest',
      'price-asc',
      'price-desc',
    ]);
    expect(webMcpCatalogSearchInputJsonSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        limit: { maximum: WEBMCP_CATALOG_LIMIT, minimum: 1 },
        sort: { enum: WEBMCP_CATALOG_SORT_VALUES },
      },
      type: 'object',
    });
    expect(webMcpProductLookupInputJsonSchema).toMatchObject({
      additionalProperties: false,
      required: ['product_id'],
      type: 'object',
    });
    expect(webMcpStorePoliciesInputJsonSchema).toEqual({
      additionalProperties: false,
      properties: {},
      type: 'object',
    });
  });
});
