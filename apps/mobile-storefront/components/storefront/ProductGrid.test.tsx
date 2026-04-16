import { jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ProductGridBlock } from '@/types/blocks';
import type { Product } from '@/types/product';
import ProductGrid from './ProductGrid';

const MockText = Text;
const mockProductGridSkeleton = jest.fn(({ count }: { count: number }) => (
  <MockText>{`skeleton-${count}`}</MockText>
));
const mockProductCard = jest.fn(({ product }: { product: Product }) => (
  <MockText>{product.name}</MockText>
));
let mockFilterBarProps: {
  onSelectCategory: (category: string) => void;
  onSelectBrand: (brand: string) => void;
  onSelectCondition?: (condition: string) => void;
  onPriceChange?: (min: number, max: number) => void;
  onSelectRating?: (rating: number) => void;
} | null = null;
const mockFilterBar = jest.fn(
  (props: {
    onSelectCategory: (category: string) => void;
    onSelectBrand: (brand: string) => void;
    onSelectCondition?: (condition: string) => void;
    onPriceChange?: (min: number, max: number) => void;
    onSelectRating?: (rating: number) => void;
  }) => {
    mockFilterBarProps = props;
    return null;
  }
);
type UseCategoriesResult = {
  data: Array<{ id: string; name: string; slug: string }>;
  isLoading?: boolean;
  isError: boolean;
  error?: unknown;
};

type UseProductBrandsResult = {
  brands: string[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof jest.fn>;
};

type UseProductsResult = {
  products: Product[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  hasMore: boolean;
  refetch: ReturnType<typeof jest.fn>;
  loadMore: ReturnType<typeof jest.fn>;
  isLoadingMore: boolean;
};

const mockUseIsFocusedHook = jest.fn<() => boolean>();
const mockPrioritizeSmartphoneProductsFactory = jest.fn(
  (products: Product[]) => products
);
const mockGetProductGridCategoriesFactory = jest.fn(
  (categories: string[]) => categories
);
const mockUseCategoriesFactory = jest.fn<() => UseCategoriesResult>();
const mockUseProductsFactory =
  jest.fn<(options: unknown) => UseProductsResult>();
const mockUseProductBrandsFactory =
  jest.fn<(options: unknown) => UseProductBrandsResult>();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockUseIsFocusedHook(),
}));

jest.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: (products: Product[]) =>
    mockPrioritizeSmartphoneProductsFactory(products),
}));

jest.mock('@/lib/category-utils', () => ({
  getProductGridCategories: (categories: string[]) =>
    mockGetProductGridCategoriesFactory(categories),
}));

jest.mock('@/hooks', () => ({
  useCategories: () => mockUseCategoriesFactory(),
  useProducts: (options: unknown) => mockUseProductsFactory(options),
  useProductBrands: (options: unknown) => mockUseProductBrandsFactory(options),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  ProductGridSkeleton: (props: { count: number }) =>
    mockProductGridSkeleton(props),
}));

jest.mock('./ProductCard', () => ({
  ProductCard: (props: { product: Product }) => mockProductCard(props),
}));

jest.mock('./FilterBar', () => ({
  FilterBar: (props: {
    onSelectCategory: (category: string) => void;
    onSelectBrand: (brand: string) => void;
    onSelectCondition?: (condition: string) => void;
    onPriceChange?: (min: number, max: number) => void;
    onSelectRating?: (rating: number) => void;
  }) => mockFilterBar(props),
}));

const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 13 Pro',
    slug: 'iphone-13-pro',
    description: 'Phone',
    price: 500000,
    image: 'https://cdn.example.com/iphone-13-pro.jpg',
    images: ['https://cdn.example.com/iphone-13-pro.jpg'],
    category: 'Phones',
    rating: 4.5,
    review_count: 10,
    in_stock: true,
  },
  {
    id: '2',
    name: 'Pixel 8',
    slug: 'pixel-8',
    description: 'Phone',
    price: 420000,
    image: 'https://cdn.example.com/pixel-8.jpg',
    images: ['https://cdn.example.com/pixel-8.jpg'],
    category: 'Phones',
    rating: 4.2,
    review_count: 8,
    in_stock: true,
  },
];

const block: ProductGridBlock = {
  type: 'ProductGrid',
  props: {
    id: 'grid-1',
    title: 'Featured',
    limit: 12,
  },
};

function mockProductsHook(overrides?: Partial<UseProductsResult>) {
  const refetch = jest.fn();
  mockUseProductsFactory.mockReturnValue({
    products: sampleProducts,
    total: sampleProducts.length,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    hasMore: false,
    refetch,
    loadMore: jest.fn(),
    isLoadingMore: false,
    ...overrides,
  });
  return refetch;
}

describe('ProductGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFilterBarProps = null;
    mockUseIsFocusedHook.mockReturnValue(true);
    mockUseCategoriesFactory.mockReturnValue({
      data: [
        { id: 'cat-phones', name: 'Phones', slug: 'phones' },
        { id: 'cat-laptops', name: 'Laptops', slug: 'laptops' },
      ],
      isError: false,
    });
    mockUseProductBrandsFactory.mockReturnValue({
      brands: ['Samsung', 'Apple'],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockProductsHook();
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
      mockFilterBarProps?.onSelectCategory('Phones');
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
      mockFilterBarProps?.onSelectBrand('Samsung');
    });
    act(() => {
      mockFilterBarProps?.onSelectCondition?.('Used');
    });
    act(() => {
      mockFilterBarProps?.onPriceChange?.(1000, 2000);
    });
    act(() => {
      mockFilterBarProps?.onSelectRating?.(4);
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
      mockFilterBarProps?.onSelectCategory('Phones');
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

  it('reveals more buffered products when the home scroll requests more items', () => {
    const loadMore = jest.fn();
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };

    mockProductsHook({
      products: sampleProducts,
      hasMore: true,
      loadMore,
    });

    const { rerender } = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(screen.queryByText('Pixel 8')).toBeNull();

    rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(screen.getByText('Pixel 8')).toBeTruthy();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('fetches another page when the home scroll requests more items than are buffered', () => {
    const loadMore = jest.fn();
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };

    mockProductsHook({
      products: [sampleProducts[0]],
      hasMore: true,
      loadMore,
    });

    const { rerender } = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not replay a stale load-more signal after pagination resets', async () => {
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };

    const view = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(screen.getByText('iPhone 13 Pro')).toBeTruthy();
    expect(screen.queryByText('Pixel 8')).toBeNull();

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pixel 8')).toBeTruthy();
    });

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId="cat-phones"
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('iPhone 13 Pro')).toBeTruthy();
      expect(screen.queryByText('Pixel 8')).toBeNull();
    });
  });

  it('processes queued load-more signals after an in-flight page finishes', async () => {
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };
    const loadMore = jest.fn();
    let productsResult: UseProductsResult = {
      products: [sampleProducts[0]],
      total: 1,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      hasMore: true,
      refetch: jest.fn(),
      loadMore,
      isLoadingMore: true,
    };
    mockUseProductsFactory.mockImplementation(() => productsResult);

    const view = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={2}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    productsResult = {
      ...productsResult,
      products: sampleProducts,
      total: sampleProducts.length,
      isLoadingMore: false,
    };

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={2}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });
  });
});
