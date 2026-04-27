import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockPush = jest.fn();
const mockAddItem = jest.fn();
const mockRemoveProduct = jest.fn();
const mockClearComparison = jest.fn();

const mockComparisonState = {
  products: [] as Array<{
    id: string;
    slug: string;
    name: string;
    price: number;
    image?: string;
    compare_at_price?: number;
    condition?: string;
    brand?: string;
    specifications?: Record<string, string>;
    rating?: number;
  }>,
  removeProduct: mockRemoveProduct,
  clearComparison: mockClearComparison,
};

type ComparisonSelector<T> = (state: typeof mockComparisonState) => T;

const mockUseShallow = jest.fn(
  <T,>(selector: ComparisonSelector<T>) => selector
);

const mockUseComparisonStore = jest.fn(<T,>(selector: ComparisonSelector<T>) =>
  selector(mockComparisonState)
);

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => ReactNode } }) =>
      options?.headerRight?.() ?? null,
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: (state: typeof mockComparisonState) => unknown) =>
    mockUseShallow(selector),
}));

jest.mock('@/components/storefront/ProductCard', () => ({
  BLURHASH_VARIANTS: { default: 'L~I64nofj[ayj[ayj[ay' },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/stores/comparison-store', () => ({
  useComparisonStore: (
    selector: (state: typeof mockComparisonState) => unknown
  ) => mockUseComparisonStore(selector),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (
    selector: (state: { addItem: typeof mockAddItem }) => unknown
  ) => selector({ addItem: mockAddItem }),
}));

import CompareScreen from '@/app/compare/index';

describe('CompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComparisonState.products = [];
  });

  it('renders comparison products and clears the comparison', () => {
    mockComparisonState.products = [
      {
        id: 'product-1',
        slug: 'test-product',
        name: 'Test Product',
        price: 1999,
      },
    ];

    render(<CompareScreen />);

    expect(screen.getByText('Test Product')).toBeTruthy();

    fireEvent.press(screen.getByText('Clear All'));
    expect(mockClearComparison).toHaveBeenCalledTimes(1);
  });

  it('renders empty state and routes to browse products', () => {
    render(<CompareScreen />);

    expect(screen.getByText('No products to compare')).toBeTruthy();

    fireEvent.press(screen.getByText('Browse Products'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
