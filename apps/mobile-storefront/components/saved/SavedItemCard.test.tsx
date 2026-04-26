import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { SavedItem } from '@/stores/saved-store';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    __esModule: true,
    default: {
      View,
    },
    FadeIn: {
      duration: () => ({}),
    },
    FadeOut: {
      duration: () => ({}),
    },
    Layout: {
      springify: () => ({}),
    },
  };
});

jest.mock('@/components/storefront/ProductCard', () => ({
  BLURHASH_VARIANTS: {
    default: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  },
}));

import { SavedItemCard } from './SavedItemCard';

const item: SavedItem = {
  id: 'saved-1',
  image: 'https://example.com/image.png',
  name: 'Test Product',
  price: 2500,
  product_id: 'product-1',
  slug: 'test-product',
  savedAt: new Date('2026-04-21T00:00:00Z').getTime(),
};

describe('SavedItemCard', () => {
  it('renders product details and dispatches the card actions', () => {
    const onAddToCart = jest.fn();
    const onPress = jest.fn();
    const onRemove = jest.fn();

    render(
      <SavedItemCard
        colors={Colors.light}
        item={item}
        onAddToCart={onAddToCart}
        onPress={onPress}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText('Test Product')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('View Test Product'));
    fireEvent.press(
      screen.getByLabelText('Remove Test Product from saved items')
    );
    fireEvent.press(screen.getByLabelText('Add Test Product to cart'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(item);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(item);
    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(item);
  });
});
