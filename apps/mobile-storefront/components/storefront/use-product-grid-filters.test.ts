import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { PRODUCT_GRID_MAX_PRICE_LIMIT } from './ProductGrid.test-utils';
import { useProductGridFilters } from './use-product-grid-filters';

describe('useProductGridFilters', () => {
  it('returns the default filter state', () => {
    const { result } = renderHook(() => useProductGridFilters());

    expect(result.current.selectedCategoryName).toBe('All');
    expect(result.current.minPrice).toBe(0);
    expect(result.current.maxPrice).toBe(PRODUCT_GRID_MAX_PRICE_LIMIT);
    expect(result.current.selectedBrand).toBe('All');
    expect(result.current.selectedCondition).toBe('All');
    expect(result.current.minRating).toBe(0);
    expect(result.current.viewMode).toBe('grid');
  });

  it('resets subordinate filters when the category changes', () => {
    const { result } = renderHook(() => useProductGridFilters());

    act(() => {
      result.current.setSelectedBrand('Samsung');
      result.current.setSelectedCondition('Used');
      result.current.handlePriceChange(1000, 2000);
      result.current.setMinRating(4);
    });

    act(() => {
      result.current.handleCategorySelect('Phones');
    });

    expect(result.current.selectedCategoryName).toBe('Phones');
    expect(result.current.selectedBrand).toBe('All');
    expect(result.current.selectedCondition).toBe('All');
    expect(result.current.minPrice).toBe(0);
    expect(result.current.maxPrice).toBe(PRODUCT_GRID_MAX_PRICE_LIMIT);
    expect(result.current.minRating).toBe(0);
  });

  it('updates the min/max price range', () => {
    const { result } = renderHook(() => useProductGridFilters());

    act(() => {
      result.current.handlePriceChange(2500, 7500);
    });

    expect(result.current.minPrice).toBe(2500);
    expect(result.current.maxPrice).toBe(7500);
  });
});
