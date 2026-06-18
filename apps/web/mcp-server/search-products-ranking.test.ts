import { describe, expect, it } from 'vitest';
import {
  buildSearchProductsV2RpcArgs,
  orderRowsByRankedProductIds,
} from './search-products-ranking';

describe('MCP search_products ranking helpers', () => {
  it('builds search_products_v2 arguments for ranked MCP catalog search', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {
          brand: 'Apple',
          condition: 'used',
          max_price: 500_000,
          min_price: 100_000,
          sort: 'price_asc',
        },
        limit: 20,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphnoe',
      })
    ).toEqual({
      brand_filter: null,
      category_id_filter: null,
      condition_filter: 'used',
      max_price_filter: 500_000,
      merchant_id_param: '123e4567-e89b-12d3-a456-426614174000',
      min_price_filter: 100_000,
      min_rating_filter: null,
      parent_only: false,
      result_limit: 100,
      result_offset: 0,
      search_query: 'iphnoe',
      sort_by: 'price_asc',
      status_filter: 'active',
      stock_filter: null,
    });
  });

  it('normalizes MCP condition aliases before building rpc arguments', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {
          condition: 'refurbished',
        },
        limit: 10,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphone',
      })
    ).toMatchObject({
      condition_filter: 'open_box',
    });
  });

  it('builds default rpc arguments when optional filters are absent', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {},
        limit: 10,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphone',
      })
    ).toMatchObject({
      brand_filter: null,
      category_id_filter: null,
      condition_filter: null,
      max_price_filter: null,
      min_price_filter: null,
      result_limit: 10,
      sort_by: 'relevance',
    });
  });

  it('uses the post-filter result buffer when only category is present', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {
          category: 'phones',
        },
        limit: 20,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphone',
      })
    ).toMatchObject({
      result_limit: 100,
    });
  });

  it('uses the post-filter result buffer when brand and category are present', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {
          brand: 'Apple',
          category: 'phones',
        },
        limit: 20,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphone',
      })
    ).toMatchObject({
      result_limit: 100,
    });
  });

  it('preserves ranked product order after product hydration', () => {
    expect(
      orderRowsByRankedProductIds(
        [
          { id: 'product-1', name: 'iPhone X' },
          { id: 'product-2', name: 'iPhone 16 Pro' },
        ],
        ['product-2', 'product-1']
    ).map((row) => row.id)
  ).toEqual(['product-2', 'product-1']);
  });

  it('preserves original order when no ranked ids are available', () => {
    const rows = [
      { id: 'product-1', name: 'iPhone X' },
      { id: 'product-2', name: 'iPhone 16 Pro' },
    ];

    expect(orderRowsByRankedProductIds(rows, [])).toEqual(rows);
  });

  it('moves unmatched ids after ranked rows', () => {
    expect(
      orderRowsByRankedProductIds(
        [
          { id: 'product-1', name: 'iPhone X' },
          { id: 'product-2', name: 'iPhone 16 Pro' },
          { id: 'product-3', name: 'iPhone Case' },
        ],
        ['product-2']
      ).map((row) => row.id)
    ).toEqual(['product-2', 'product-1', 'product-3']);
  });

  it('handles empty row arrays', () => {
    expect(orderRowsByRankedProductIds([], ['product-1'])).toEqual([]);
  });
});
