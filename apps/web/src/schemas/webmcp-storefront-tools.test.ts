import { describe, expect, it } from 'vitest';
import {
  WEBMCP_CATALOG_LIMIT,
  webMcpCatalogSearchInputJsonSchema,
  webMcpCatalogSearchInputSchema,
  webMcpProductLookupInputJsonSchema,
  webMcpProductLookupInputSchema,
  webMcpStorePoliciesInputJsonSchema,
  webMcpStorePoliciesInputSchema,
} from './webmcp-storefront-tools';

describe('webmcp-storefront-tools schemas', () => {
  it('normalizes optional catalog search strings and keeps safe numeric bounds', () => {
    expect(
      webMcpCatalogSearchInputSchema.parse({
        brand: ' Apple ',
        category: ' Phones ',
        limit: 5,
        query: ' iphone ',
        sort: 'price-desc',
      })
    ).toEqual({
      brand: 'Apple',
      category: 'Phones',
      limit: 5,
      query: 'iphone',
      sort: 'price-desc',
    });
  });

  it('drops invalid optional catalog search values instead of trusting tool input', () => {
    expect(
      webMcpCatalogSearchInputSchema.parse({
        brand: '',
        limit: WEBMCP_CATALOG_LIMIT + 1,
        query: '   ',
        sort: 'unsafe',
      })
    ).toEqual({
      brand: undefined,
      limit: undefined,
      query: undefined,
      sort: undefined,
    });
  });

  it('requires a non-empty product ID for product lookup', () => {
    expect(
      webMcpProductLookupInputSchema.safeParse({ product_id: ' product-1 ' })
    ).toMatchObject({
      success: true,
      data: { product_id: 'product-1' },
    });

    expect(webMcpProductLookupInputSchema.safeParse({})).toMatchObject({
      success: false,
    });
  });

  it('keeps exported JSON input schemas aligned with WebMCP tool names', () => {
    expect(webMcpCatalogSearchInputJsonSchema).toMatchObject({
      type: 'object',
      properties: {
        limit: { maximum: WEBMCP_CATALOG_LIMIT },
        sort: { enum: ['newest', 'price-asc', 'price-desc'] },
      },
    });
    expect(webMcpProductLookupInputJsonSchema).toMatchObject({
      required: ['product_id'],
    });
    expect(webMcpStorePoliciesInputJsonSchema).toMatchObject({
      type: 'object',
      properties: {},
    });
  });

  it('accepts empty store policy input and rejects non-object payloads', () => {
    expect(webMcpStorePoliciesInputSchema.safeParse(undefined)).toMatchObject({
      success: true,
    });
    expect(webMcpStorePoliciesInputSchema.safeParse({})).toMatchObject({
      success: true,
    });
    expect(
      webMcpStorePoliciesInputSchema.safeParse({ extra: 'field' })
    ).toMatchObject({
      success: true,
    });
    expect(webMcpStorePoliciesInputSchema.safeParse('bad')).toMatchObject({
      success: false,
    });
  });
});
