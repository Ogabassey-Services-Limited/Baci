import type { Category } from '@/hooks';
import {
  filterProductsByClientCategory,
  resolveNormalizedCategoryId,
  resolveProductGridRenderFlags,
  resolveSelectedCategoryName,
  shouldRetryCategoriesOnProductRetry,
} from './product-grid.helpers';

describe('product-grid.helpers', () => {
  it('resolves normalized category id from filter first, then all-category fallback', () => {
    expect(
      resolveNormalizedCategoryId({
        selectedCategoryId: 'cat-parent',
        selectedCategoryIdFromFilter: 'cat-filter',
        selectedCategorySlug: 'phones',
      })
    ).toBe('cat-filter');

    expect(
      resolveNormalizedCategoryId({
        selectedCategoryId: 'cat-parent',
        selectedCategoryIdFromFilter: null,
        selectedCategorySlug: 'all',
      })
    ).toBe('cat-parent');

    expect(
      resolveNormalizedCategoryId({
        selectedCategoryId: 'u-local',
        selectedCategoryIdFromFilter: null,
        selectedCategorySlug: 'all',
      })
    ).toBeUndefined();
  });

  it('resolves selected category display name and falls back to All', () => {
    const normalizedCategories: Category[] = [
      { id: '1', name: 'Phones', slug: 'phones' },
      { id: '2', name: 'Laptops', slug: 'laptops' },
    ];

    expect(
      resolveSelectedCategoryName({
        categoryNames: ['Phones', 'Laptops'],
        normalizedCategories,
        selectedCategorySlug: 'phones',
      })
    ).toEqual({
      matchedCategoryName: 'Phones',
      selectedCategoryName: 'Phones',
    });

    expect(
      resolveSelectedCategoryName({
        categoryNames: ['Phones', 'Laptops'],
        normalizedCategories,
        selectedCategorySlug: 'unknown',
      })
    ).toEqual({
      matchedCategoryName: undefined,
      selectedCategoryName: 'All',
    });
  });

  it('filters products client-side only when categories are not yet loaded', () => {
    const products = [
      { id: '1', category: 'Phones' },
      { id: '2', category: 'Laptops' },
      { id: '3', category: '' },
    ] as never[];

    expect(
      filterProductsByClientCategory({
        normalizedCategories: [],
        products,
        selectedCategorySlug: 'phones',
      }).map((product) => product.id)
    ).toEqual(['1']);

    expect(
      filterProductsByClientCategory({
        normalizedCategories: [{ id: '1', name: 'Phones', slug: 'phones' }],
        products,
        selectedCategorySlug: 'phones',
      }).map((product) => product.id)
    ).toEqual(['1', '2', '3']);
  });

  it('computes product grid render flags', () => {
    expect(
      resolveProductGridRenderFlags({
        isCategoriesError: true,
        isCategoriesFetching: true,
        isError: true,
        isFetchedAfterMount: true,
        isLoading: false,
        productsLength: 0,
        uniqueVisibleProductsLength: 0,
      })
    ).toEqual({
      hasRenderableProducts: false,
      isRetrying: true,
      shouldShowFatalError: true,
      shouldShowInitialLoading: false,
    });

    expect(
      resolveProductGridRenderFlags({
        isCategoriesError: false,
        isCategoriesFetching: false,
        isError: false,
        isFetchedAfterMount: false,
        isLoading: false,
        productsLength: 0,
        uniqueVisibleProductsLength: 0,
      }).shouldShowInitialLoading
    ).toBe(true);
  });

  it('decides when category retry should also refetch category options', () => {
    expect(
      shouldRetryCategoriesOnProductRetry({
        isCategoriesError: true,
        isCategoriesFetchedAfterMount: true,
        isCategoriesFetching: false,
        isCategoriesLoading: false,
      })
    ).toBe(true);

    expect(
      shouldRetryCategoriesOnProductRetry({
        isCategoriesError: true,
        isCategoriesFetchedAfterMount: false,
        isCategoriesFetching: false,
        isCategoriesLoading: false,
      })
    ).toBe(false);
  });
});
