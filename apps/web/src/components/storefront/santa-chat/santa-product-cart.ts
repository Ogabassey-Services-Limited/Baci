import type { Product } from '@/lib/products';
import { readSantaMerchantSlug } from './read-santa-merchant-slug';

interface AddSantaProductToCartOptions {
  productName: string;
  negotiatedPrice: number;
  addToCart: (product: Product, quantity?: number) => void;
  setMerchantSlug: (merchantSlug: string) => void;
  applyNegotiatedPrice?: (cartItemId: string, newPrice: number) => void;
  showNotification: (message: string) => void;
}

export async function addSantaProductToCart({
  productName,
  negotiatedPrice,
  addToCart,
  setMerchantSlug,
  applyNegotiatedPrice,
  showNotification,
}: AddSantaProductToCartOptions): Promise<void> {
  try {
    const response = await fetch('/api/chat/santa/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: productName }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('[Santa Cart] Failed to fetch product');
      return;
    }

    const resolvedMerchantSlug = readSantaMerchantSlug(response);
    if (resolvedMerchantSlug) {
      setMerchantSlug(resolvedMerchantSlug);
    }

    const { product } = (await response.json()) as {
      product: Product | null;
    };

    if (!product) {
      console.error('[Santa Cart] Product not found:', productName);
      showNotification(`Could not find "${productName}" in catalog`);
      return;
    }

    addToCart(product, 1);

    if (applyNegotiatedPrice && negotiatedPrice < product.price) {
      applyNegotiatedPrice(product.id, negotiatedPrice);
    }

    showNotification(`${product.name} added to cart!`);
  } catch (error) {
    console.error('[Santa Cart] Error adding to cart:', error);
  }
}
