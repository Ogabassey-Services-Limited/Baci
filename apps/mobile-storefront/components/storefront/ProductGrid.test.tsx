import { act, render } from '@testing-library/react-native';
import {
  block,
  getMockFilterBarProps,
  mockGetProductGridCategoriesFactory,
  mockProductBrandsHook,
  mockProductCard,
  mockProductGridSkeleton,
  mockProductsHook,
  mockUseCategoriesFactory,
  mockUseProductBrandsFactory,
  mockUseProductsFactory,
  ProductGrid,
  resetProductGridTestState,
  sampleProducts,
} from './ProductGrid.test-utils';

describe('ProductGrid', () => {
  beforeEach(() => {
    resetProductGridTestState();
  });

  it('renders ProductGridSkeleton while loading', () => {
    mockProductsHook({ isLoading: true, products: [] });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(mockProductGridSkeleton).toHaveBeenCalled();
    expect(mockProductGridSkeleton.mock.calls[0][0]).toEqual({ count: 4 });
  });

  it('renders ProductCard entries when products are returned', () => {
    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(mockProductCard).toHaveBeenCalledTimes(2);
    expect(mockProductCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        product: expect.objectContaining({ name: 'iPhone 13 Pro' }),
      })
    );
    expect(mockProductCard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        product: expect.objectContaining({ name: 'Pixel 8' }),
      })
    );
  });

  it('deduplicates products by id, keeping the first occurrence', () => {
    const firstProduct = sampleProducts[0];
    const secondProduct = sampleProducts[1];
    if (!firstProduct || !secondProduct) {
      throw new Error('Expected sample products for duplicate-id regression');
    }

    // This verifies ID-based deduplication, not name-based filtering.
    mockProductsHook({
      products: [
        firstProduct,
        { ...firstProduct, name: 'Duplicate iPhone' },
        secondProduct,
      ],
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(mockProductCard).toHaveBeenCalledTimes(2);
    expect(
      mockProductCard.mock.calls.map(([props]) => props.product.name)
    ).toEqual(['iPhone 13 Pro', 'Pixel 8']);
  });

  it('derives curated product-grid categories from loaded products', () => {
    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(mockGetProductGridCategoriesFactory).toHaveBeenCalledWith([
      'Phones',
      'Laptops',
    ]);
  });

  it('restores category chips from loaded products when the categories query is unavailable', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isFetchedAfterMount: true,
      isFetching: false,
      isError: true,
      error: new Error('cats'),
    });
    mockGetProductGridCategoriesFactory.mockReturnValue(['Phones']);

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(getMockFilterBarProps()?.categories).toEqual(['All', 'Phones']);
    expect(getMockFilterBarProps()?.selectedCategory).toBe('All');
  });

  it('resets subordinate filters when switching top-level categories', () => {
    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    act(() => {
      getMockFilterBarProps()?.onSelectBrand('Samsung');
    });
    act(() => {
      getMockFilterBarProps()?.onSelectCondition?.('Used');
    });
    act(() => {
      getMockFilterBarProps()?.onPriceChange?.(1000, 2000);
    });
    act(() => {
      getMockFilterBarProps()?.onSelectRating?.(4);
    });

    let latestOptions =
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0];
    expect(latestOptions).toMatchObject({
      brand: 'Samsung',
      condition: 'Used',
      minPrice: 1000,
      maxPrice: 2000,
      minRating: 4,
    });

    act(() => {
      getMockFilterBarProps()?.onSelectCategory('Phones');
    });

    latestOptions =
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0];
    expect(latestOptions).toMatchObject({
      category: 'cat-phones',
      brand: undefined,
      condition: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
    });
  });

  it('keeps brand options disabled until brand filtering is requested', () => {
    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(mockUseProductBrandsFactory).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );

    act(() => {
      getMockFilterBarProps()?.onBrandFilterVisible?.();
    });

    expect(mockUseProductBrandsFactory).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });

  it('keeps a selected brand while lazy brand options are still loading', () => {
    mockProductBrandsHook({
      brands: [],
      isLoading: true,
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    act(() => {
      getMockFilterBarProps()?.onSelectBrand('Samsung');
    });

    const latestOptions =
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0];
    expect(getMockFilterBarProps()?.selectedBrand).toBe('Samsung');
    expect(latestOptions).toMatchObject({ brand: 'Samsung' });
  });

  it('falls back to an empty brand list when lazy brand options fail', () => {
    mockProductBrandsHook({
      brands: [],
      isError: true,
      error: new Error('brands unavailable'),
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    act(() => {
      getMockFilterBarProps()?.onBrandFilterVisible?.();
    });

    expect(getMockFilterBarProps()?.brands).toEqual([]);
  });

  it('does not refetch products just because the Home tab regains focus', () => {
    const refetch = mockProductsHook();

    const { rerender } = render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    rerender(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );
    rerender(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(refetch).not.toHaveBeenCalled();
  });
});
