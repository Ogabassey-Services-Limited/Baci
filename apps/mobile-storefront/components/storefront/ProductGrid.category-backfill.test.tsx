import { jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import {
  block,
  getMockFilterBarProps,
  mockGetProductGridCategoriesFactory,
  mockProductCard,
  mockProductsHook,
  mockUseCategoriesFactory,
  mockUseProductsFactory,
  ProductGrid,
  resetProductGridTestState,
  sampleProducts,
} from './ProductGrid.test-utils';

describe('ProductGrid category filtering and backfill', () => {
  beforeEach(() => {
    resetProductGridTestState();
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
});
