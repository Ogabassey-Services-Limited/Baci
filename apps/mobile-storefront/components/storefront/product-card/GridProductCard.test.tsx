import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import type { Product } from '@/types/product';
import { formatPrice } from '@/types/product';
import GridProductCard from './GridProductCard';

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: jest.requireActual('react-native').View,
    createAnimatedComponent: (component: unknown) => component,
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    Ionicons: ({ name, ...props }: { name: string }) =>
      React.createElement(Text, { testID: `icon-${name}`, ...props }, name),
  };
});

const baseProduct: Product = {
  id: 'product-1',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  price: 552000,
  image: 'https://cdn.example.com/iphone-13-pro.jpg',
  images: ['https://cdn.example.com/iphone-13-pro.jpg'],
  condition: 'New',
  rating: 4.2,
  review_count: 12,
};

function renderCard(
  overrides: Partial<ComponentProps<typeof GridProductCard>> = {}
) {
  const props: ComponentProps<typeof GridProductCard> = {
    product: baseProduct,
    imageSource: { uri: baseProduct.image },
    imageProps: { contentFit: 'cover' },
    showLocalPlaceholder: false,
    handlePress: jest.fn(),
    handleAnimateIn: jest.fn(),
    handleAnimateOut: jest.fn(),
    handleWishlistPress: jest.fn(),
    handleAddToCart: jest.fn(),
    isSaved: false,
    cartItemCount: 0,
    animatedStyle: {},
    heartAnimatedStyle: {},
    gridWidth: 180,
    shadowColor: '#000',
    ...overrides,
  };

  return {
    ...render(<GridProductCard {...props} />),
    props,
  };
}

describe('GridProductCard', () => {
  it('renders placeholder content when no local image is available', () => {
    renderCard({ showLocalPlaceholder: true });

    expect(screen.getByTestId('grid-product-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('grid-product-image')).toBeNull();
  });

  it('renders product details, image, and rating state', () => {
    renderCard();

    expect(screen.getByText(baseProduct.name)).toBeTruthy();
    expect(screen.getByText(formatPrice(baseProduct.price))).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByLabelText(`${baseProduct.name} image`)).toBeTruthy();
    expect(screen.queryAllByTestId('icon-star')).toHaveLength(4);
    expect(screen.queryAllByTestId('icon-star-outline')).toHaveLength(1);
  });

  it('formats condition badges in sentence case on the grid card', () => {
    renderCard({
      product: {
        ...baseProduct,
        condition: 'Open Box',
      },
    });

    expect(screen.getByText('Open Box')).toBeTruthy();
  });

  it('renders a no-ratings state when product rating is missing', () => {
    renderCard({
      product: {
        ...baseProduct,
        condition: undefined,
        rating: undefined,
      },
    });

    expect(screen.getByLabelText('No ratings')).toBeTruthy();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('wires press handlers for the card, wishlist, and add-to-cart actions', () => {
    const handlePress = jest.fn();
    const handleWishlistPress = jest.fn();
    const handleAddToCart = jest.fn();

    renderCard({
      handlePress,
      handleWishlistPress,
      handleAddToCart,
      cartItemCount: 2,
      isSaved: true,
    });

    fireEvent.press(
      screen.getByLabelText(`${baseProduct.name}, ${formatPrice(baseProduct.price)}`)
    );
    fireEvent.press(
      screen.getByLabelText(`Remove ${baseProduct.name} from saved items`)
    );
    fireEvent.press(screen.getByLabelText(`Add ${baseProduct.name} to cart`));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(handleWishlistPress).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
