import { describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import type { Category } from '@/hooks';
import { useProductGridCategories } from './use-product-grid-categories';

const settled = {
  isCategoriesLoading: false,
  isCategoriesFetching: false,
  isCategoriesFetchedAfterMount: true,
  isCategoriesError: false,
  isProductsLoading: false,
  isProductsFetching: false,
  isProductsFetchedAfterMount: true,
} as const;

const inFlight = {
  ...settled,
  isCategoriesLoading: true,
  isCategoriesFetchedAfterMount: false,
  isProductsLoading: true,
  isProductsFetchedAfterMount: false,
} as const;

function makeCategory(name: string): Category {
  return { id: name.toLowerCase(), name, slug: name.toLowerCase() } as Category;
}

describe('useProductGridCategories', () => {
  it('returns ["All"] when both sources are empty', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useProductGridCategories({
        normalizedCategories: [],
        products: [],
        ...settled,
      })
    );

    expect(result.current.categoryNames).toEqual(['All']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      '[ProductGrid] No category chips resolved'
    );
    warnSpy.mockRestore();
  });

  it('does not warn while either query is still loading', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() =>
      useProductGridCategories({
        normalizedCategories: [],
        products: [],
        ...inFlight,
      })
    );

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('uses merchant categories as the canonical source when non-empty', () => {
    const { result } = renderHook(() =>
      useProductGridCategories({
        normalizedCategories: [
          makeCategory('Smartphones'),
          makeCategory('Laptops'),
        ],
        // Audio is on products but NOT in merchant categories. It must NOT
        // appear in the chip list — otherwise tapping the chip wouldn't
        // resolve to a category id and the grid would stay unfiltered while
        // the chip looks active. (Codex P1 review on PR #1391.)
        products: [{ category: 'Audio' }, { category: 'Smartphones' }],
        ...settled,
      })
    );

    expect(result.current.categoryNames[0]).toBe('All');
    expect(result.current.categoryNames).toContain('Smartphones');
    expect(result.current.categoryNames).toContain('Laptops');
    expect(result.current.categoryNames).not.toContain('Audio');
  });

  it('falls back to product-derived categories only when merchant categories are empty', () => {
    const { result } = renderHook(() =>
      useProductGridCategories({
        normalizedCategories: [],
        products: [{ category: 'Audio' }, { category: 'Smartphones' }],
        ...settled,
      })
    );

    expect(result.current.categoryNames[0]).toBe('All');
    expect(result.current.categoryNames).toContain('Audio');
    expect(result.current.categoryNames).toContain('Smartphones');
  });

  it('only emits the diagnostic warn once across re-renders', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { rerender } = renderHook(
      ({ products }: { products: Array<{ category?: string }> }) =>
        useProductGridCategories({
          normalizedCategories: [],
          products,
          ...settled,
        }),
      { initialProps: { products: [] as Array<{ category?: string }> } }
    );

    rerender({ products: [] as Array<{ category?: string }> });
    rerender({ products: [] as Array<{ category?: string }> });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
