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

  it('shows only the All chip until merchant categories are loaded', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isError: false,
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(getMockFilterBarProps()?.categories).toEqual(['All']);
  });

  it('does not fall back to a stale parent category when a chip cannot resolve to a real category id', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [{ id: 'cat-laptops', name: 'Laptops', slug: 'laptops' }],
      isError: false,
    });

    render(
      <ProductGrid
        block={block}
        selectedCategoryId="cat-parent"
        variant="grid"
      />
    );

    act(() => {
      getMockFilterBarProps()?.onSelectCategory('Phones');
    });

    const latestOptions =
      mockUseProductsFactory.mock.calls[
        mockUseProductsFactory.mock.calls.length - 1
      ]?.[0];
    expect(latestOptions).toMatchObject({
      category: undefined,
      limit: block.props.limit! * 4,
    });
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

  it('renders fallback UI when categories query errors', () => {
    mockUseCategoriesFactory.mockReturnValue({
      data: [],
      isError: true,
      error: new Error('cats'),
    });
    mockProductsHook({ isLoading: false, isError: false });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(screen.getByTestId('product-grid-error')).toBeTruthy();
    expect(mockProductCard).not.toHaveBeenCalled();
    expect(mockProductGridSkeleton).not.toHaveBeenCalled();
  });

  it('renders fallback UI when products query errors', () => {
    mockProductsHook({
      products: [],
      isLoading: false,
      isError: true,
      error: 'prods',
    });

    render(
      <ProductGrid block={block} selectedCategoryId={null} variant="grid" />
    );

    expect(screen.getByTestId('product-grid-error')).toBeTruthy();
    expect(mockProductCard).not.toHaveBeenCalled();
    expect(mockProductGridSkeleton).not.toHaveBeenCalled();
  });
});
