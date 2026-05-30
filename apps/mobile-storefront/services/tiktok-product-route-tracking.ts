import { useEffect, useRef } from 'react';
import {
  trackAddToCart,
  trackAddToWishlist,
  trackProductViewed,
} from '@/services/ad-tracking';

interface ProductRouteTrackingInput {
  brand?: string;
  category?: string;
  description?: string;
  id: string;
  name?: string;
}

function toProductPayload(product: ProductRouteTrackingInput, price: number) {
  return {
    brand: product.brand,
    category: product.category,
    description: product.description,
    id: product.id,
    name: product.name ?? product.id,
    price,
  };
}

export function useTrackProductRouteViewed(
  product: ProductRouteTrackingInput | null,
  price: number
) {
  const trackedProductViewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!product || trackedProductViewRef.current === product.id) {
      return;
    }

    trackedProductViewRef.current = product.id;
    void trackProductViewed(toProductPayload(product, price));
  }, [price, product]);
}

export function trackProductRouteAddToCart(
  product: ProductRouteTrackingInput,
  price: number
) {
  return trackAddToCart({
    ...toProductPayload(product, price),
    quantity: 1,
  });
}

export function trackProductRouteWishlistAdd(
  product: ProductRouteTrackingInput,
  price: number
) {
  return trackAddToWishlist(toProductPayload(product, price));
}
