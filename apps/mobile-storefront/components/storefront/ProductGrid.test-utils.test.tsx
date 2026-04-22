import { beforeEach, describe, expect, it } from '@jest/globals';
import { PRODUCT_GRID_MAX_PRICE_LIMIT as PRODUCT_GRID_MAX_PRICE_LIMIT_SOURCE } from '@/constants/product-grid';
import {
  getMockFilterBarProps,
  mockProductsHook,
  mockUseProductsFactory,
  PRODUCT_GRID_MAX_PRICE_LIMIT,
  resetProductGridTestState,
  sampleProducts,
} from './ProductGrid.test-utils';

describe('ProductGrid.test-utils', () => {
  beforeEach(() => {
    resetProductGridTestState();
  });

  it('re-exports the product grid max price limit constant', () => {
    expect(PRODUCT_GRID_MAX_PRICE_LIMIT).toBe(
      PRODUCT_GRID_MAX_PRICE_LIMIT_SOURCE
    );
  });

  it('resets the shared test state to default product hook values', () => {
    expect(getMockFilterBarProps()).toBeNull();

    const result = mockUseProductsFactory({});

    expect(result.products).toEqual(sampleProducts);
    expect(result.total).toBe(sampleProducts.length);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(false);
    expect(result.isError).toBe(false);
    expect(result.hasMore).toBe(false);
    expect(result.isLoadingMore).toBe(false);
  });

  it('supports overriding mocked product hook values', () => {
    const refetch = mockProductsHook({
      products: [],
      total: 0,
      isLoading: true,
      hasMore: true,
      isLoadingMore: true,
    });

    const result = mockUseProductsFactory({});

    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.isLoading).toBe(true);
    expect(result.hasMore).toBe(true);
    expect(result.isLoadingMore).toBe(true);
    expect(result.refetch).toBe(refetch);
  });
});
