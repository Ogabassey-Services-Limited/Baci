import { jest } from '@jest/globals';
import { Text } from 'react-native';
import type { ProductGridBlock } from '@/types/blocks';
import type { Product } from '@/types/product';

const MockText = Text;
export const mockProductGridSkeleton = jest.fn(
  ({ count }: { count: number }) => <MockText>{`skeleton-${count}`}</MockText>
);
export const mockProductCard = jest.fn(({ product }: { product: Product }) => (
  <MockText>{product.name}</MockText>
));

let mockFilterBarProps: {
  onSelectCategory: (category: string) => void;
  onSelectBrand: (brand: string) => void;
  onSelectCondition?: (condition: string) => void;
  onPriceChange?: (min: number, max: number) => void;
  onSelectRating?: (rating: number) => void;
} | null = null;

export type UseCategoriesResult = {
  data: Array<{ id: string; name: string; slug: string }>;
  isLoading?: boolean;
  isError: boolean;
  error?: unknown;
};

export type UseProductBrandsResult = {
  brands: string[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof jest.fn>;
};

export type UseProductsResult = {
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

export const mockUseIsFocusedHook = jest.fn<() => boolean>();
export const mockPrioritizeSmartphoneProductsFactory = jest.fn(
  (products: Product[]) => products
);
export const mockGetProductGridCategoriesFactory = jest.fn(
  (categories: string[]) => categories
);
export const mockUseCategoriesFactory = jest.fn<() => UseCategoriesResult>();
export const mockUseProductsFactory =
  jest.fn<(options: unknown) => UseProductsResult>();
export const mockUseProductBrandsFactory =
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
  }) => {
    mockFilterBarProps = props;
    return null;
  },
}));

export const sampleProducts: Product[] = [
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

export const extendedSampleProducts: Product[] = [
  ...sampleProducts,
  {
    id: '3',
    name: 'Galaxy S24 Ultra',
    slug: 'galaxy-s24-ultra',
    description: 'Phone',
    price: 610000,
    image: 'https://cdn.example.com/galaxy-s24-ultra.jpg',
    images: ['https://cdn.example.com/galaxy-s24-ultra.jpg'],
    category: 'Phones',
    rating: 4.8,
    review_count: 14,
    in_stock: true,
  },
];

export const block: ProductGridBlock = {
  type: 'ProductGrid',
  props: {
    id: 'grid-1',
    title: 'Featured',
    limit: 12,
  },
};

export function mockProductsHook(overrides?: Partial<UseProductsResult>) {
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

export function getMockFilterBarProps() {
  return mockFilterBarProps;
}

export function resetProductGridTestState() {
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
}

export { default as ProductGrid } from './ProductGrid';
