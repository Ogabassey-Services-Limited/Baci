import type { SantaAction } from '@baci/shared/lib';
import { santaProductLookupResponseSchema } from '@/schemas/santa-product-lookup';
import type { SantaProductLookupResult } from '@/schemas/santa-product-lookup';
import { showCartToast } from '@/hooks/cart-notifications';
import { createLogger } from '@/lib/logger';
import { useCartStore } from '@/stores/cart-store';
import type { CartItem } from '@/stores/cart-store.types';
import { API_BASE_URL } from './constants';

const log = createLogger('santa-cart');

async function lookupSantaProduct(
  productName: string,
  signal?: AbortSignal
): Promise<SantaProductLookupResult | null> {
  const response = await fetch(`${API_BASE_URL}/api/chat/santa/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: productName }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Santa product lookup failed (${response.status})`);
  }

  const parsed = santaProductLookupResponseSchema.safeParse(
    await response.json()
  );

  if (!parsed.success) {
    throw new Error('Santa product lookup returned an invalid payload');
  }

  return parsed.data.product;
}

function buildSantaCartItem(
  product: SantaProductLookupResult,
  grantedPrice: number
): Omit<CartItem, 'id'> {
  // Santa already negotiated the price the customer should pay. Only treat it as
  // a negotiated price when it actually beats the catalog price (mirrors web).
  const hasDiscount = grantedPrice >= 0 && grantedPrice < product.price;
  const managesStock = product.manage_stock === true;

  return {
    product_id: product.id,
    slug: '',
    name: product.name,
    price: product.price,
    quantity: 1,
    image_url: product.image || undefined,
    max_quantity: managesStock ? product.stock : undefined,
    negotiatedPrice: hasDiscount ? grantedPrice : undefined,
    negotiationStatus: hasDiscount ? 'accepted' : undefined,
  };
}

/**
 * Fulfil a Santa `ADD_TO_CART` wish: resolve the product (real or synthetic)
 * and add it to the cart at Santa's granted price. Best-effort — surfaces a
 * toast on success/failure and never throws (chat flow must continue).
 */
export async function addSantaWishToCart(
  action: SantaAction,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const product = await lookupSantaProduct(action.productName, signal);
    if (!product) {
      showCartToast(
        `Santa couldn't find "${action.productName}" in the store`,
        'error'
      );
      return false;
    }

    useCartStore.getState().addItem(buildSantaCartItem(product, action.price));
    showCartToast(`🎁 ${product.name} added to your cart`, 'success');
    return true;
  } catch (error) {
    log.error('Failed to add Santa wish to cart:', error);
    showCartToast('Could not add Santa’s gift to your cart', 'error');
    return false;
  }
}
