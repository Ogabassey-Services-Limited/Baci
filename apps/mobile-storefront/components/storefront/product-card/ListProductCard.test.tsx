import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import { sanitizeDescriptionPlainText } from '@/components/storefront/utils/text';
import type { Product } from '@/types/product';
import { formatPrice } from '@/types/product';
import ListProductCard from './ListProductCard';

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (component: unknown) => component,
  },
}));

jest.mock('@react-native-vector-icons/ionicons/static', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    Ionicons: ({ name, ...props }: { name: string }) =>
      React.createElement(Text, { testID: `icon-${name}`, ...props }, name),

    default: ({ name, ...props }: { name: string }) =>
      React.createElement(
        Text,
        {
          testID: `icon-${name}`,
          ...props,
        },
        name
      ),
    __esModule: true,
  };
});

const baseProduct: Product = {
  id: 'product-1',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  description:
    '<p>Premium flagship phone with pro cameras and long battery life for creators.</p>',
  price: 552000,
  image: 'https://cdn.example.com/iphone-13-pro.jpg',
  images: ['https://cdn.example.com/iphone-13-pro.jpg'],
  rating: 3.7,
  review_count: 12,
};

function renderCard(
  overrides: Partial<ComponentProps<typeof ListProductCard>> = {}
) {
  const props: ComponentProps<typeof ListProductCard> = {
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
    colors: Colors.light,
    ...overrides,
  };

  return {
    ...render(<ListProductCard {...props} />),
    props,
  };
}

describe('ListProductCard', () => {
  it('renders a local placeholder when showLocalPlaceholder is true', () => {
    renderCard({ showLocalPlaceholder: true });

    expect(screen.getByTestId('list-product-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('list-product-image')).toBeNull();
  });

  it('renders the product image when showLocalPlaceholder is false', () => {
    renderCard({ showLocalPlaceholder: false });

    expect(screen.getByTestId('list-product-image')).toBeTruthy();
    expect(screen.queryByTestId('list-product-placeholder')).toBeNull();
  });

  it('renders filled and outline stars based on product rating', () => {
    renderCard({ product: { ...baseProduct, rating: 3.7 } });

    expect(screen.queryAllByTestId('icon-star')).toHaveLength(3);
    expect(screen.queryAllByTestId('icon-star-outline')).toHaveLength(2);
  });

  it('renders sanitized and truncated product description text', () => {
    const longDescription =
      '<p>This <b>device</b> has excellent battery life, flagship camera performance, smooth display, and premium build quality for demanding users.</p>';
    const sanitized = sanitizeDescriptionPlainText(longDescription).substring(
      0,
      100
    );

    renderCard({
      product: {
        ...baseProduct,
        description: longDescription,
      },
    });

    expect(screen.getByText(sanitized)).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText(sanitized).props.style)
    ).toMatchObject({ color: Colors.light.mutedForeground });
  });

  it('shows cart badge when cartItemCount > 0 and hides it when 0', () => {
    const { rerender } = renderCard({ cartItemCount: 3 });
    expect(StyleSheet.flatten(screen.getByText('3').props.style)).toMatchObject(
      { color: BRAND.onPrimary }
    );

    rerender(
      <ListProductCard
        product={baseProduct}
        imageSource={{ uri: baseProduct.image }}
        imageProps={{ contentFit: 'cover' }}
        showLocalPlaceholder={false}
        handlePress={jest.fn()}
        handleAnimateIn={jest.fn()}
        handleAnimateOut={jest.fn()}
        handleWishlistPress={jest.fn()}
        handleAddToCart={jest.fn()}
        isSaved={false}
        cartItemCount={0}
        animatedStyle={{}}
        heartAnimatedStyle={{}}
        colors={Colors.light}
      />
    );

    expect(screen.queryByText('3')).toBeNull();
  });

  it('toggles wishlist icon state for saved and unsaved modes', () => {
    const { rerender } = renderCard({ isSaved: true });
    expect(screen.getByTestId('icon-heart')).toBeTruthy();

    rerender(
      <ListProductCard
        product={baseProduct}
        imageSource={{ uri: baseProduct.image }}
        imageProps={{ contentFit: 'cover' }}
        showLocalPlaceholder={false}
        handlePress={jest.fn()}
        handleAnimateIn={jest.fn()}
        handleAnimateOut={jest.fn()}
        handleWishlistPress={jest.fn()}
        handleAddToCart={jest.fn()}
        isSaved={false}
        cartItemCount={0}
        animatedStyle={{}}
        heartAnimatedStyle={{}}
        colors={Colors.light}
      />
    );

    expect(screen.getByTestId('icon-heart-outline')).toBeTruthy();
  });

  it('exposes accessibility labels and wires press handlers', () => {
    const handlePress = jest.fn();
    const handleAddToCart = jest.fn();
    const handleWishlistPress = jest.fn();

    renderCard({
      handlePress,
      handleAddToCart,
      handleWishlistPress,
      cartItemCount: 2,
    });

    fireEvent.press(
      screen.getByLabelText(
        `${baseProduct.name}, ${formatPrice(baseProduct.price)}`
      )
    );
    fireEvent.press(screen.getByLabelText(`Add ${baseProduct.name} to cart`));
    fireEvent.press(
      screen.getByLabelText(`Save ${baseProduct.name} for later`)
    );

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).toHaveBeenCalledTimes(1);
    expect(handleWishlistPress).toHaveBeenCalledTimes(1);
  });
});
