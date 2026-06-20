import { jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
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

function product(id: string, name = `Product ${id}`): Product {
  return {
    id,
    name,
    slug: `product-${id}`,
    price: 1000,
    image: `https://cdn.example.com/${id}.jpg`,
    images: [`https://cdn.example.com/${id}.jpg`],
    in_stock: true,
  };
}

const FILTER_BAR_PROP_KEYS = [
  'brands',
  'categories',
  'maxPrice',
  'minPrice',
  'minRating',
  'onBrandFilterVisible',
  'onPriceChange',
  'onSelectBrand',
  'onSelectCategory',
  'onSelectCondition',
  'onSelectRating',
  'onViewModeChange',
  'selectedBrand',
  'selectedCategory',
  'selectedCondition',
  'viewMode',
].sort();

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

function renderFeed(
  options: Partial<Parameters<typeof useHomeProductFeed>[0]> = {}
) {
  return renderHook(() =>
    useHomeProductFeed({
      enabled: true,
      selectedCategoryId: null,
      variant: 'grid',
      limit: 12,
      ...options,
    })
  );
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

describe('useHomeProductFeed', () => {
  it('exposes feedProducts deduped by id', () => {
    setProducts({
      products: [product('p1', 'First'), product('p1', 'Dup'), product('p2')],
    } as Partial<ReturnType<typeof useProducts>>);

    const { result } = renderFeed();

    expect(result.current.feedProducts.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('returns the full FilterBar prop surface', () => {
    const { result } = renderFeed();

    expect(Object.keys(result.current.filterBarProps).sort()).toEqual(
      FILTER_BAR_PROP_KEYS
    );
    expect(result.current.filterBarProps.categories).toEqual(['All']);
  });

  it('computes currentVariant from the variant input', () => {
    const { result } = renderFeed({ variant: 'editorial' });

    expect(result.current.currentVariant).toBe('editorial');
  });

  it('gates product and brand queries when not enabled', () => {
    renderFeed({ enabled: false });

    expect(mockUseProducts.mock.calls[0][0]).toMatchObject({ enabled: false });
    expect(mockUseProductBrands.mock.calls[0][0]).toMatchObject({
      enabled: false,
    });
  });

  it('returns a stable feedResetKey that changes with the limit input', () => {
    const { result: a } = renderFeed({ limit: 12 });
    const { result: b } = renderFeed({ limit: 24 });

    expect(a.current.feedResetKey).not.toEqual(b.current.feedResetKey);
  });

  // PRODUCT_GRID_BACKFILL_FLOOR is 6.
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

  it('handleRetry also refetches categories when categories errored', () => {
    const refetchProducts = jest.fn();
    const refetchCategories = jest.fn();
    setProducts({ refetch: refetchProducts } as Partial<
      ReturnType<typeof useProducts>
    >);
    setCategories({
      isError: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isLoading: false,
      refetch: refetchCategories,
    });

    const { result } = renderFeed();
    act(() => {
      result.current.handleRetry();
    });

    expect(refetchProducts).toHaveBeenCalled();
    expect(refetchCategories).toHaveBeenCalled();
  });

  it('flags a fatal error once products error after the first fetch', () => {
    setProducts({
      products: [],
      isError: true,
      isFetchedAfterMount: true,
      isLoading: false,
    } as Partial<ReturnType<typeof useProducts>>);

    const { result } = renderFeed();

    expect(result.current.shouldShowFatalError).toBe(true);
  });

  it('flags initial loading before the first fetch resolves', () => {
    setProducts({
      products: [],
      isLoading: true,
      isFetchedAfterMount: false,
    } as Partial<ReturnType<typeof useProducts>>);

    const { result } = renderFeed();

    expect(result.current.shouldShowInitialLoading).toBe(true);
  });

  it('handleRetry refetches only products when categories are healthy', () => {
    const refetchProducts = jest.fn();
    const refetchCategories = jest.fn();
    setProducts({
      refetch: refetchProducts,
      isError: true,
      isFetchedAfterMount: true,
    } as Partial<ReturnType<typeof useProducts>>);
    setCategories({ isError: false, refetch: refetchCategories });

    const { result } = renderFeed();
    act(() => {
      result.current.handleRetry();
    });

    expect(refetchProducts).toHaveBeenCalled();
    expect(refetchCategories).not.toHaveBeenCalled();
  });

  it('marks isRetrying while products are background-fetching', () => {
    setProducts({ isFetching: true } as Partial<
      ReturnType<typeof useProducts>
    >);

    const { result } = renderFeed();

    expect(result.current.isRetrying).toBe(true);
  });

  it('resets a vanished brand selection back to All', () => {
    mockUseProductBrands.mockReturnValue({
      brands: ['Samsung'],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useProductBrands>);

    const { result } = renderFeed();
    act(() => {
      result.current.filterBarProps.onSelectBrand('Tecno');
    });

    expect(result.current.filterBarProps.selectedBrand).toBe('All');
  });
});
