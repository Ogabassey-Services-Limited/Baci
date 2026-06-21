import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Product } from '@/types/product';
import { trackCartAdd, trackWishlistAdd } from './product-card-tracking';

const mockTrackAddToWishlist = jest.fn();
const mockTrackAddToCart = jest.fn();

jest.mock('@/services/ad-tracking', () => ({
  trackAddToWishlist: (...args: unknown[]) => mockTrackAddToWishlist(...args),
  trackAddToCart: (...args: unknown[]) => mockTrackAddToCart(...args),
}));

const product = {
  id: 'p1',
  name: 'Pixel 9',
  slug: 'pixel-9',
  price: 1000,
  category: 'Phones',
  brand: 'Google',
  image: 'https://cdn.example.com/p1.jpg',
  images: ['https://cdn.example.com/p1.jpg'],
} as Product;

// Flush the dynamic import() + its .then microtask chain.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('product-card-tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports a wishlist add with the product summary', async () => {
    trackWishlistAdd(product);
    await flush();

    expect(mockTrackAddToWishlist).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Pixel 9',
      price: 1000,
      category: 'Phones',
      brand: 'Google',
    });
  });

  it('reports an add-to-cart with quantity 1 and the resolved price', async () => {
    trackCartAdd(product, 850);
    await flush();

    expect(mockTrackAddToCart).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Pixel 9',
      price: 850,
      quantity: 1,
      category: 'Phones',
      brand: 'Google',
    });
  });
});
