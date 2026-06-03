import { render, screen } from '@testing-library/react-native';
import {
  block,
  mockProductCard,
  mockProductGridSkeleton,
  mockProductsHook,
  mockUseCategoriesFactory,
  ProductGrid,
  resetProductGridTestState,
  sampleProducts,
} from './ProductGrid.test-utils';

describe('ProductGrid error states', () => {
  beforeEach(() => {
    resetProductGridTestState();
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
