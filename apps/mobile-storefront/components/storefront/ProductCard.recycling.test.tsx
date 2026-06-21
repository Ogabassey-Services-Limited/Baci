import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Product } from '@/types/product';
import { ProductCard } from './ProductCard';

jest.mock('expo-image', () => ({ Image: 'Image' }));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({ items: [], addItem: jest.fn() }),
  selectCartQuantities: () => new Map<string, number>(),
}));

jest.mock('@/stores/saved-store', () => ({
  useSavedStore: (selector: (state: unknown) => unknown) =>
    selector({ items: [], toggleSaved: jest.fn() }),
  selectSavedProductIds: () => new Set<string>(),
}));

function makeProduct(id: string, image: string): Product {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 1000,
    image,
    images: [image],
    condition: 'New',
  };
}

const productA = makeProduct('a', 'https://cdn.example.com/a.jpg');
const productB = makeProduct('b', 'https://cdn.example.com/b.jpg');

function failImageUntilPlaceholder() {
  // One candidate → two onError events flip showLocalPlaceholder to true.
  const image = screen.getByTestId('grid-product-image');
  fireEvent(image, 'error');
  fireEvent(screen.getByTestId('grid-product-image'), 'error');
}

describe('ProductCard image-fallback recycling safety', () => {
  it('resets the local placeholder state when a recycled card switches product', () => {
    const { rerender } = render(
      <ProductCard product={productA} variant="grid" />
    );

    failImageUntilPlaceholder();
    expect(screen.getByTestId('grid-product-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('grid-product-image')).toBeNull();

    // Recycle the same instance for a different product.
    rerender(<ProductCard product={productB} variant="grid" />);

    expect(screen.getByTestId('grid-product-image')).toBeTruthy();
    expect(screen.queryByTestId('grid-product-placeholder')).toBeNull();
  });
});
