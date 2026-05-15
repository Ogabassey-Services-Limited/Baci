import { act, render, screen } from '@testing-library/react-native';
import {
  block,
  getMockFilterBarProps,
  mockGetProductGridCategoriesFactory,
  mockPrioritizeSmartphoneProductsFactory,
  mockProductCard,
  mockProductGridSkeleton,
  mockProductsHook,
  mockUseCategoriesFactory,
  mockUseIsFocusedHook,
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

  it('applies prioritizeSmartphoneProducts and curated product-grid categories', () => {
    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(mockGetProductGridCategoriesFactory).toHaveBeenCalledWith([
      'Phones',
      'Laptops',
    ]);
    expect(mockPrioritizeSmartphoneProductsFactory).toHaveBeenCalledWith(
      sampleProducts
    );
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

  it('refetches when focus is regained after initial mount', () => {
    mockUseIsFocusedHook
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
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

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to default categories instead of blocking the grid when categories query errors', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isFetchedAfterMount: true,
      isFetching: false,
      isError: true,
      error: new Error('cats'),
    });
    mockProductsHook({ isLoading: false, isError: false });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.queryByText('Failed to load products. Please try again.')
    ).toBeNull();
    expect(mockProductCard).toHaveBeenCalledTimes(2);
    expect(mockProductGridSkeleton).not.toHaveBeenCalled();
  });

  it('renders fallback UI when categories and products both fail without cached data', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isFetchedAfterMount: false,
      isFetching: false,
      isError: true,
      isLoading: false,
      error: new Error('cats'),
    });
    mockProductsHook({
      products: [],
      isFetchedAfterMount: true,
      isLoading: false,
      isError: true,
      error: 'prods',
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.getByText('Failed to load products. Please try again.')
    ).toBeTruthy();
    expect(mockProductCard).not.toHaveBeenCalled();
  });

  it('renders fallback UI when products query errors', () => {
    mockProductsHook({
      products: [],
      isFetchedAfterMount: true,
      isLoading: false,
      isError: true,
      error: 'prods',
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.getByText('Failed to load products. Please try again.')
    ).toBeTruthy();
    expect(mockProductCard).not.toHaveBeenCalled();
    expect(mockProductGridSkeleton).not.toHaveBeenCalled();
  });

  it('keeps rendering cached products during a transient products refetch error', () => {
    mockProductsHook({
      products: sampleProducts,
      isFetchedAfterMount: true,
      isLoading: false,
      isFetching: true,
      isError: true,
      error: 'prods',
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.queryByText('Failed to load products. Please try again.')
    ).toBeNull();
    expect(mockProductCard).toHaveBeenCalledTimes(2);
  });

  it('shows a skeleton instead of flashing a stale products error before the mount fetch settles', () => {
    mockProductsHook({
      products: [],
      isFetchedAfterMount: false,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: 'prods',
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.queryByText('Failed to load products. Please try again.')
    ).toBeNull();
    expect(mockProductGridSkeleton).toHaveBeenCalled();
    expect(mockProductCard).not.toHaveBeenCalled();
  });

  it('keeps showing the retry UI while a manual retry is in flight without cached products', () => {
    mockProductsHook({
      products: [],
      isFetchedAfterMount: true,
      isLoading: false,
      isFetching: true,
      isError: true,
      error: 'prods',
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.getByText('Failed to load products. Please try again.')
    ).toBeTruthy();
    expect(screen.getByText('Retrying...')).toBeTruthy();
    expect(mockProductGridSkeleton).not.toHaveBeenCalled();
    expect(mockProductCard).not.toHaveBeenCalled();
  });

  it('keeps the retry button enabled when categories do a background revalidation without error', () => {
    mockProductsHook({
      products: [],
      isFetchedAfterMount: true,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: 'prods',
    });
    mockUseCategoriesFactory.mockReturnValue({
      data: [
        { id: 'cat-phones', name: 'Phones', slug: 'phones' },
        { id: 'cat-laptops', name: 'Laptops', slug: 'laptops' },
      ],
      isFetchedAfterMount: true,
      isFetching: true,
      isError: false,
      isLoading: false,
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.getByText('Failed to load products. Please try again.')
    ).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.queryByText('Retrying...')).toBeNull();
  });

  it('keeps rendering products when categories refetch fails after categories were already cached', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [
        { id: 'cat-phones', name: 'Phones', slug: 'phones' },
        { id: 'cat-laptops', name: 'Laptops', slug: 'laptops' },
      ],
      isFetchedAfterMount: true,
      isFetching: false,
      isError: true,
      isLoading: false,
      error: new Error('cats'),
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(
      screen.queryByText('Failed to load products. Please try again.')
    ).toBeNull();
    expect(mockProductCard).toHaveBeenCalledTimes(2);
  });
});
