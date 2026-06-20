import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import {
  OgabasseyPdpCriticalCommerceProvider,
  useOgabasseyPdpCriticalCommerce,
} from './critical-commerce-state.client';

const cartMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  setIsCartOpen: vi.fn(),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    addToCart: cartMocks.addToCart,
    setIsCartOpen: cartMocks.setIsCartOpen,
  }),
}));

const variantCartProduct: CartProduct = {
  brand: 'Xiaomi',
  condition: 'new',
  description: 'Redmi Pad 2',
  gtin: '',
  has_variants: true,
  id: 'redmi-pad-2',
  image: 'https://cdn.ogabassey.com/redmi-pad-2.avif',
  imageHint: 'Redmi Pad 2',
  imageLarge: 'https://cdn.ogabassey.com/redmi-pad-2.avif',
  manage_stock: true,
  mpn: 'redmi-pad-2',
  name: 'Redmi Pad 2',
  price: 237_674.42,
  status: 'active',
  stock: 10,
  variants: [
    {
      attributes: { ram: '4GB', storage: '128GB' },
      id: 'variant-128-4',
      merchant_id: 'merchant-1',
      price_override: 237_674.42,
      product_id: 'redmi-pad-2',
      stock_quantity: 10,
    },
    {
      attributes: { ram: '8GB', storage: '256GB' },
      id: 'variant-256-8',
      merchant_id: 'merchant-1',
      price_override: 278_418.6,
      product_id: 'redmi-pad-2',
      stock_quantity: 8,
    },
  ],
};

function CriticalCommerceStateProbe() {
  const commerce = useOgabasseyPdpCriticalCommerce();

  return (
    <>
      <p>{commerce.productForCart.price}</p>
      <p>{commerce.canAddToCart ? 'ready' : 'blocked'}</p>
      <button
        onClick={() => commerce.handleAttributeSelection('storage', '256GB')}
        type="button"
      >
        Select 256GB storage
      </button>
      <button
        onClick={() => commerce.handleAttributeSelection('ram', '8GB')}
        type="button"
      >
        Select 8GB RAM
      </button>
      <button
        disabled={!commerce.canAddToCart}
        onClick={commerce.handleAddToCart}
        type="button"
      >
        Add to cart
      </button>
    </>
  );
}

beforeEach(() => {
  cartMocks.addToCart.mockClear();
  cartMocks.setIsCartOpen.mockClear();
});

describe('OgabasseyPdpCriticalCommerceProvider', () => {
  it('shares selected variant state with summary and cart controls', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={variantCartProduct}
        variantAxes={['storage', 'ram']}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('237674.42')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /select 256gb storage/i })
    );

    expect(screen.getByText('blocked')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /select 8gb ram/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 278_418.6,
        stock: 8,
      }),
      1,
      expect.objectContaining({
        storage: '256GB',
        variantAttributes: {
          ram: '8GB',
          storage: '256GB',
        },
        variantId: 'variant-256-8',
      })
    );
    expect(cartMocks.setIsCartOpen).toHaveBeenCalledWith(true);
  });
});
