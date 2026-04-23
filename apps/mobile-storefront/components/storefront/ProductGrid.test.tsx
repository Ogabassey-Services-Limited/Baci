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
