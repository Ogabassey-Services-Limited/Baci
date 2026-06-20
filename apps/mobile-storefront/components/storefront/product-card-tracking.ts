import type { Product } from '@/types/product';

/** Fire-and-forget wishlist-add ad event (lazy-imports the tracking service). */
export function trackWishlistAdd(product: Product): void {
  void import('@/services/ad-tracking').then(({ trackAddToWishlist }) => {
    void trackAddToWishlist({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      brand: product.brand,
    });
  });
}

/** Fire-and-forget add-to-cart ad event (lazy-imports the tracking service). */
export function trackCartAdd(product: Product, price: number): void {
  void import('@/services/ad-tracking').then(({ trackAddToCart }) => {
    void trackAddToCart({
      id: product.id,
      name: product.name,
      price,
      quantity: 1,
      category: product.category,
      brand: product.brand,
    });
  });
}
