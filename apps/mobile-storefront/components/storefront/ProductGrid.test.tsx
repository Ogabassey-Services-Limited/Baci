import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useIsFocused } from '@react-navigation/native';
import { act, render, screen } from '@testing-library/react-native';
import { useCategories, useProductBrands, useProducts } from '@/hooks';
import { getProductGridCategories } from '@/lib/category-utils';
import type { ProductGridBlock } from '@/types/blocks';
import type { Product } from '@/types/product';
import ProductGrid from './ProductGrid';

const mockProductGridSkeleton = jest.fn(
  ({ count }: { count: number }) => `skeleton-${count}`
);
const mockProductCard = jest.fn(
  ({ product }: { product: Product }) => product.name
);
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

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(),
}));

jest.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: jest.fn((products: Product[]) => products),
}));

jest.mock('@/lib/category-utils', () => ({
  getProductGridCategories: jest.fn((categories: string[]) => categories),
}));

jest.mock('@/hooks', () => ({
  useCategories: jest.fn(),
  useProducts: jest.fn(),
  useProductBrands: jest.fn(() => ({ brands: [] })),
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

const mockUseCategories = useCategories as jest.MockedFunction<
  typeof useCategories
>;
const mockUseProducts = useProducts as jest.MockedFunction<typeof useProducts>;
const mockUseProductBrands = useProductBrands as jest.MockedFunction<
  typeof useProductBrands
>;
const mockUseIsFocused = useIsFocused as jest.MockedFunction<
  typeof useIsFocused
>;
const mockGetProductGridCategories =
  getProductGridCategories as jest.MockedFunction<
    typeof getProductGridCategories
  >;
const mockPrioritizeSmartphoneProducts =
  prioritizeSmartphoneProducts as jest.MockedFunction<
    typeof prioritizeSmartphoneProducts
  >;

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

function mockProductsHook(overrides?: Partial<ReturnType<typeof useProducts>>) {
  const refetch = jest.fn();
  mockUseProducts.mockReturnValue({
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
    mockUseIsFocused.mockReturnValue(true);
    mockUseCategories.mockReturnValue({
      data: [
        { id: 'cat-phones', name: 'Phones', slug: 'phones' },
        { id: 'cat-laptops', name: 'Laptops', slug: 'laptops' },
      ],
      isError: false,
    } as unknown as ReturnType<typeof useCategories>);
    mockUseProductBrands.mockReturnValue({
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

    expect(mockGetProductGridCategories).toHaveBeenCalledWith([
      'Phones',
      'Laptops',
    ]);
    expect(mockPrioritizeSmartphoneProducts).toHaveBeenCalledWith(
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
      mockUseProducts.mock.calls[mockUseProducts.mock.calls.length - 1]?.[0];
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
      mockUseProducts.mock.calls[mockUseProducts.mock.calls.length - 1]?.[0];
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
      mockUseProducts.mock.calls[mockUseProducts.mock.calls.length - 1]?.[0];
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
    mockUseIsFocused
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
    mockUseCategories.mockReturnValue({
      data: [],
      isError: true,
      error: new Error('cats'),
    } as unknown as ReturnType<typeof useCategories>);
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
