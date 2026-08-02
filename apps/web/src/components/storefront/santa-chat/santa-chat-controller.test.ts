import { afterEach, describe, expect, it, vi } from 'vitest';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';
import type { Product } from '@/lib/products';
import { addSantaProductToCart } from './santa-chat-controller';

describe('addSantaProductToCart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('switches to the resolved tenant before adding the product', async () => {
    const invocationOrder: string[] = [];
    const product = {
      id: 'phone-1',
      name: 'Phone',
      price: 500,
    } as unknown as Product;
    const setMerchantSlug = vi.fn(() => {
      invocationOrder.push('setMerchantSlug');
    });
    const addToCart = vi.fn(() => {
      invocationOrder.push('addToCart');
    });
    const applyNegotiatedPrice = vi.fn();
    const showNotification = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ product }), {
          headers: {
            'Content-Type': 'application/json',
            [SANTA_MERCHANT_SLUG_HEADER]: 'winter-store',
          },
          status: 200,
        })
      )
    );

    await addSantaProductToCart({
      productName: 'Phone',
      negotiatedPrice: 450,
      addToCart,
      setMerchantSlug,
      applyNegotiatedPrice,
      showNotification,
    });

    expect(invocationOrder).toEqual(['setMerchantSlug', 'addToCart']);
    expect(applyNegotiatedPrice).toHaveBeenCalledWith('phone-1', 450);
    expect(showNotification).toHaveBeenCalledWith('Phone added to cart!');
  });
});
