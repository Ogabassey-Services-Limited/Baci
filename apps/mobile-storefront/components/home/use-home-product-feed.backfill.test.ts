import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { useProductGridCategories } from '@/components/storefront/use-product-grid-categories';
import { useCategories, useProductBrands, useProducts } from '@/hooks';
import type { Product } from '@/types/product';
import { useHomeProductFeed } from './use-home-product-feed';

jest.mock('@/hooks', () => ({
  useCategories: jest.fn(),
  useProductBrands: jest.fn(),
  useProducts: jest.fn(),
}));

jest.mock('@/components/storefront/use-product-grid-categories', () => ({
  useProductGridCategories: jest.fn(),
}));

const mockUseCategories = useCategories as jest.MockedFunction<
  typeof useCategories
>;
const mockUseProducts = useProducts as jest.MockedFunction<typeof useProducts>;
const mockUseProductBrands = useProductBrands as jest.MockedFunction<
  typeof useProductBrands
>;
const mockUseProductGridCategories =
  useProductGridCategories as jest.MockedFunction<
    typeof useProductGridCategories
  >;

function product(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 1000,
    image: `https://cdn.example.com/${id}.jpg`,
    images: [`https://cdn.example.com/${id}.jpg`],
    in_stock: true,
  };
}

function setProducts(overrides: Partial<ReturnType<typeof useProducts>> = {}) {
  mockUseProducts.mockReturnValue({
    products: [product('p1'), product('p2')],
    total: 2,
    hasMore: false,
    isFetchedAfterMount: true,
    isLoading: false,
    isLoadingMore: false,
    isFetching: false,
    isError: false,
    error: null,
    loadMore: jest.fn(),
    refetch: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useProducts>);
}

function setCategories(overrides: Record<string, unknown> = {}) {
  mockUseCategories.mockReturnValue({
    data: [],
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCategories>);
}

function renderFeed() {
  return renderHook(() =>
    useHomeProductFeed({
      enabled: true,
      selectedCategoryId: null,
      variant: 'grid',
      limit: 12,
    })
  );
}

function setFeed(
  count: number,
  overrides: Partial<ReturnType<typeof useProducts>> = {}
) {
  const loadMore = jest.fn();
  setProducts({
    products: Array.from({ length: count }, (_, i) => product(`p${i}`)),
    hasMore: true,
    loadMore,
    ...overrides,
  } as Partial<ReturnType<typeof useProducts>>);
  return loadMore;
}

beforeEach(() => {
  jest.clearAllMocks();
  setProducts();
  setCategories();
  mockUseProductBrands.mockReturnValue({
    brands: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useProductBrands>);
  mockUseProductGridCategories.mockReturnValue({
    categoryNames: ['All'],
    merchantCategoryNames: [],
    productCategoryNames: [],
  });
});

describe('useHomeProductFeed backfill', () => {
  // PRODUCT_GRID_BACKFILL_FLOOR is 6.
  it('backfills exactly once when below the floor (no re-fire on rerender)', () => {
    const loadMore = setFeed(2);

    const { rerender } = renderFeed();
    rerender(undefined); // identical state must not re-fire the effect

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('backfills a feed just below the floor (5)', () => {
    const loadMore = setFeed(5);
    renderFeed();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not backfill at the floor (6)', () => {
    const loadMore = setFeed(6);
    renderFeed();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('does not backfill while a background fetch is in flight', () => {
    const loadMore = setFeed(2, { isFetching: true });
    renderFeed();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('does not backfill while loading the next page', () => {
    const loadMore = setFeed(2, { isLoadingMore: true });
    renderFeed();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('does not backfill a thin feed when there are no more pages', () => {
    const loadMore = setFeed(2, { hasMore: false });
    renderFeed();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('does not backfill when the feed already fills the viewport', () => {
    const loadMore = setFeed(12);
    renderFeed();
    expect(loadMore).not.toHaveBeenCalled();
  });
});
