import { render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import type { Product } from '@/types/product';
import { ProductCard } from './ProductCard';
import type GridProductCard from './product-card/GridProductCard';

const mockGridProductCard = jest.fn(
  (_props: ComponentProps<typeof GridProductCard>) => null
);

jest.mock('./product-card/GridProductCard', () => ({
  __esModule: true,
  default: (props: ComponentProps<typeof GridProductCard>) =>
    mockGridProductCard(props),
}));
jest.mock('./product-card/EditorialProductCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./product-card/ListProductCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ light: jest.fn() }),
}));
jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));
jest.mock('@/stores/cart-store', () => ({
  selectCartQuantities: () => new Map(),
  useCartStore: (selector: (state: { addItem: jest.Mock }) => unknown) =>
    selector({ addItem: jest.fn() }),
}));
jest.mock('@/stores/saved-store', () => ({
  selectSavedProductIds: () => new Set(),
  useSavedStore: (selector: (state: { toggleSaved: jest.Mock }) => unknown) =>
    selector({ toggleSaved: jest.fn() }),
}));

const product: Product = {
  id: 'product-1',
  image: 'https://cdn.example.com/large-product.avif',
  name: 'Large Product Image',
  price: 100_000,
  slug: 'large-product-image',
};

describe('ProductCard image memory behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bounds Android decoding and requests iOS early resizing for oversized images', () => {
    render(<ProductCard product={product} />);

    expect(mockGridProductCard).toHaveBeenCalledWith(
      expect.objectContaining({
        imageProps: expect.objectContaining({
          allowDownscaling: true,
          enforceEarlyResizing: true,
        }),
        imageSource: expect.objectContaining({
          height: expect.any(Number),
          uri: product.image,
          width: expect.any(Number),
        }),
      })
    );
  });
});
