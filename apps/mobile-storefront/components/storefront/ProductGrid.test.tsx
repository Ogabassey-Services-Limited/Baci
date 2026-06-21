import { jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
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

  it('filters visible products client-side when category ids are unavailable but category names exist', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isFetchedAfterMount: true,
      isFetching: false,
      isError: true,
      error: new Error('cats'),
    });
    mockProductsHook({
      products: [
        ...sampleProducts,
        {
          id: '3',
          name: 'MacBook Air',
          slug: 'macbook-air',
          description: 'Laptop',
          price: 800000,
          image: 'https://cdn.example.com/macbook-air.jpg',
          images: ['https://cdn.example.com/macbook-air.jpg'],
          category: 'Laptops',
          rating: 4.7,
          review_count: 12,
          in_stock: true,
        },
      ],
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    mockProductCard.mockClear();

    act(() => {
      getMockFilterBarProps()?.onSelectCategory('Laptops');
    });

    const renderedProductNames = mockProductCard.mock.calls.map(
      ([props]) => props.product.name
    );

    expect(renderedProductNames).toEqual(['MacBook Air']);
  });

  it('backfills client-filtered category grids before applying the display cap', async () => {
    const loadMore = jest.fn();
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isFetchedAfterMount: true,
      isFetching: false,
      isError: true,
      error: new Error('cats'),
    });
    mockGetProductGridCategoriesFactory.mockReturnValue(['Phones']);
    mockProductsHook({
      products: sampleProducts,
      hasMore: true,
      loadMore,
    });

    render(
      <ProductGrid
        block={{ ...block, props: { ...block.props, limit: 4 } }}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    act(() => {
      getMockFilterBarProps()?.onSelectCategory('Phones');
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });
    expect(
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0]
    ).toMatchObject({ category: undefined });
  });

  it('updates category filter from FilterBar interaction', () => {
    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    act(() => {
      getMockFilterBarProps()?.onSelectCategory('Phones');
    });

    const latestOptions =
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0];
    expect(latestOptions).toMatchObject({ category: 'cat-phones' });
  });

  it('maps category chip selections through a normalized category slug before filtering', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [{ id: 'cat-phones', name: 'Smartphones', slug: 'phones' }],
      isError: false,
    });
    mockGetProductGridCategoriesFactory.mockReturnValue(['Phones']);

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    act(() => {
      getMockFilterBarProps()?.onSelectCategory('Phones');
    });

    const latestOptions =
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0];
    expect(latestOptions).toMatchObject({ category: 'cat-phones' });
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
