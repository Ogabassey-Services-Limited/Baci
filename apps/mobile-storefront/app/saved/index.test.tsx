/**
 * Regression tests for SavedItemsScreen
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: mockPush },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => React.ReactNode;
    ListHeaderComponent?: () => React.ReactNode;
    ListEmptyComponent?: () => React.ReactNode;
  }) => {
    const { View } = require('react-native');
    return (
      <View>
        {ListHeaderComponent?.()}
        {data.length === 0
          ? ListEmptyComponent?.()
          : data.map((item, index) =>
              renderItem({ item })
            )}
      </View>
    );
  },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  Layout: { springify: () => ({}) },
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

const mockItems = jest.fn(() => []);
const mockRemoveItem = jest.fn();
const mockClearSaved = jest.fn();
const mockAddItem = jest.fn();

jest.mock('@/stores/saved-store', () => ({
  useSavedStore: (selector: (state: unknown) => unknown) =>
    selector({
      items: mockItems(),
      removeItem: mockRemoveItem,
      clearSaved: mockClearSaved,
    }),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({
      addItem: mockAddItem,
    }),
}));

jest.mock('@/components/storefront/ProductCard', () => ({
  BLURHASH_VARIANTS: { default: 'L~I64nofj[ayj[ayj[ay' },
}));

jest.mock('@/constants/Colors', () => ({
  __esModule: true,
  default: {
    light: {
      background: '#fff',
      text: '#000',
      textSecondary: '#666',
      card: '#f0f0f0',
      border: '#ddd',
    },
  },
  BRAND: { primary: '#007AFF' },
  RADIUS: { lg: 12, md: 8, sm: 4 },
  SHADOWS: { sm: {} },
  SPACING: { md: 16, lg: 24, xl: 32, sm: 8, xs: 4 },
}));

jest.mock('@/types/product', () => ({
  formatPrice: (price: number) => `₦${price}`,
  getDiscountPercentage: () => null,
}));

import SavedItemsScreen from './index';

const makeSavedItem = (overrides = {}) => ({
  id: 'item-1',
  product_id: 'prod-1',
  name: 'Test Phone',
  slug: 'test-phone',
  price: 50000,
  image: 'https://example.com/image.jpg',
  savedAt: Date.now(),
  ...overrides,
});

describe('SavedItemsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItems.mockReturnValue([]);
  });

  it('does not navigate when the saved item has no slug', () => {
    const itemWithoutSlug = makeSavedItem({ slug: '' });
    mockItems.mockReturnValue([itemWithoutSlug]);

    render(<SavedItemsScreen />);

    // Find and press the product item card area
    const pressable = screen.getByRole('button', { name: 'Test Phone' });
    if (pressable) {
      fireEvent.press(pressable);
    } else {
      // Try any pressable within the card
      const pressables = screen.queryAllByRole('button');
      // Press the first pressable that might be the product card
      if (pressables.length > 0) {
        fireEvent.press(pressables[0]);
      }
    }

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to product page when slug is present', () => {
    const itemWithSlug = makeSavedItem({ slug: 'test-phone' });
    mockItems.mockReturnValue([itemWithSlug]);

    render(<SavedItemsScreen />);

    const pressables = screen.queryAllByRole('button');
    // The item content Pressable is the first one
    if (pressables.length > 0) {
      fireEvent.press(pressables[0]);
    }

    expect(mockPush).toHaveBeenCalledWith('/product/test-phone');
  });
});
