import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

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
    Screen: () => null,
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

import CompareScreen from './index';

describe('CompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComparisonState.products = [];
  });

  it('selects products and actions through useShallow', () => {
    render(<CompareScreen />);

    expect(mockUseShallow).toHaveBeenCalledTimes(1);
    const selector = mockUseShallow.mock.calls[0]?.[0] as (
      state: typeof mockComparisonState
    ) => unknown;

    expect(selector(mockComparisonState)).toEqual({
      products: mockComparisonState.products,
      removeProduct: mockRemoveProduct,
      clearComparison: mockClearComparison,
    });
  });

  it('renders empty state and routes to browse products', () => {
    render(<CompareScreen />);

    expect(screen.getByText('No products to compare')).toBeTruthy();

    fireEvent.press(screen.getByText('Browse Products'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
