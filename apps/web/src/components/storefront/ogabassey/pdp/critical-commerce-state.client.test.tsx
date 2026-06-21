import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      <p>axes:{commerce.renderableVariantAxes.join(',')}</p>
      <p>explicit axes:{commerce.explicitSelectedAxes.join(',')}</p>
      <p>selected condition:{commerce.selectedAttributes.condition || ''}</p>
      <p>selected storage:{commerce.selectedAttributes.storage || ''}</p>
      <button
        onClick={() => commerce.handleAttributeSelection('condition', 'new')}
        type="button"
      >
        Select new condition
      </button>
      <button
        onClick={() => commerce.handleAttributeSelection('condition', 'used')}
        type="button"
      >
        Select used condition
      </button>
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

  it('allows the default SKU when no variant options require selection', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          price: 237_674.42,
          variants: [
            {
              attributes: { Storage: '128GB' },
              id: 'variant-128',
              merchant_id: 'merchant-1',
              price_override: 237_674.42,
              product_id: 'redmi-pad-2',
              stock_quantity: 4,
            },
          ],
        }}
        variantAxes={['storage']}
        variantCount={1}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('ready')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 237_674.42,
        stock: 4,
      }),
      1,
      expect.objectContaining({
        storage: '128GB',
        variantAttributes: {
          storage: '128GB',
        },
        variantId: 'variant-128',
      })
    );
  });

  it('does not scope the default SKU to a stale parent condition', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          condition: 'new',
          variants: [
            {
              attributes: { storage: '128GB' },
              condition: 'used',
              id: 'variant-used-128',
              merchant_id: 'merchant-1',
              price_override: 237_674.42,
              product_id: 'redmi-pad-2',
              stock_quantity: 4,
            },
          ],
        }}
        variantAxes={['storage']}
        variantCount={1}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('ready')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'used',
        price: 237_674.42,
      }),
      1,
      expect.objectContaining({
        condition: 'used',
        variantId: 'variant-used-128',
      })
    );
  });

  it('uses the selected multi-condition SKU for price and cart options', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          condition: 'new',
          price: 552_000,
          variants: [
            {
              attributes: { storage: '128GB' },
              condition: 'used',
              id: 'variant-used-128',
              merchant_id: 'merchant-1',
              price_override: 500_000,
              product_id: 'redmi-pad-2',
              stock_quantity: 3,
            },
            {
              attributes: { storage: '128GB' },
              id: 'variant-new-128',
              merchant_id: 'merchant-1',
              price_override: 552_000,
              product_id: 'redmi-pad-2',
              stock_quantity: 5,
            },
          ],
        }}
        variantAxes={['condition', 'storage']}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    // The initial summary state comes from the default purchasable SKU, not
    // the parent product's stale condition or base price.
    expect(screen.getByText('500000')).toBeInTheDocument();
    expect(screen.getByText('selected condition:used')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /select new condition/i })
    );

    expect(screen.getByText('552000')).toBeInTheDocument();
    expect(screen.getByText('selected condition:new')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'new',
        price: 552_000,
        stock: 5,
      }),
      1,
      expect.objectContaining({
        condition: 'new',
        storage: '128GB',
        variantId: 'variant-new-128',
      })
    );
  });

  it('treats a top-level route condition as an explicit selector axis', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          condition: 'new',
          price: 552_000,
          variants: [
            {
              attributes: { storage: '128GB' },
              condition: 'used',
              id: 'variant-used-128',
              merchant_id: 'merchant-1',
              price_override: 500_000,
              product_id: 'redmi-pad-2',
              stock_quantity: 3,
            },
            {
              attributes: { storage: '256GB' },
              id: 'variant-new-256',
              merchant_id: 'merchant-1',
              price_override: 552_000,
              product_id: 'redmi-pad-2',
              stock_quantity: 5,
            },
          ],
        }}
        initialVariantSelection={{ condition: 'used' }}
        variantAxes={['condition', 'storage']}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('selected condition:used')).toBeInTheDocument();
    expect(screen.getByText('explicit axes:condition')).toBeInTheDocument();
  });

  it('keeps required color-only axes hidden until explicitly selected', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          variants: [
            {
              attributes: { color: 'Black' },
              id: 'variant-black',
              merchant_id: 'merchant-1',
              price_override: 237_674.42,
              product_id: 'redmi-pad-2',
              stock_quantity: 4,
            },
            {
              attributes: { color: 'Blue' },
              id: 'variant-blue',
              merchant_id: 'merchant-1',
              price_override: 278_418.6,
              product_id: 'redmi-pad-2',
              stock_quantity: 6,
            },
          ],
        }}
        variantAxes={[]}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('axes:')).toBeInTheDocument();
    expect(screen.getByText('blocked')).toBeInTheDocument();
  });

  it('warns in development when a hidden required axis is missing upstream selection', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          variants: [
            {
              attributes: { color: 'Black' },
              id: 'variant-black',
              merchant_id: 'merchant-1',
              price_override: 237_674.42,
              product_id: 'redmi-pad-2',
              stock_quantity: 4,
            },
            {
              attributes: { color: 'Blue' },
              id: 'variant-blue',
              merchant_id: 'merchant-1',
              price_override: 278_418.6,
              product_id: 'redmi-pad-2',
              stock_quantity: 6,
            },
          ],
        }}
        variantAxes={[]}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('blocked')).toBeInTheDocument();
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        '[Ogabassey PDP] Missing hidden required variant selection.',
        {
          axes: ['color'],
          productId: 'redmi-pad-2',
        }
      );
    });
  });

  it('preselects single-option visible axes from the default SKU', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          variants: [
            {
              attributes: { color: 'Black', storage: '128GB' },
              id: 'variant-black',
              merchant_id: 'merchant-1',
              price_override: 237_674.42,
              product_id: 'redmi-pad-2',
              stock_quantity: 4,
            },
            {
              attributes: { color: 'Blue', storage: '128GB' },
              id: 'variant-blue',
              merchant_id: 'merchant-1',
              price_override: 278_418.6,
              product_id: 'redmi-pad-2',
              stock_quantity: 6,
            },
          ],
        }}
        variantAxes={['storage']}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('axes:storage')).toBeInTheDocument();
    expect(screen.getByText('selected storage:128GB')).toBeInTheDocument();
  });

  it('blocks checkout when a visible change prunes an explicit hidden SKU axis', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={{
          ...variantCartProduct,
          variants: [
            {
              attributes: { color: 'Black', storage: '128GB' },
              id: 'variant-black-128',
              merchant_id: 'merchant-1',
              price_override: 237_674.42,
              product_id: 'redmi-pad-2',
              stock_quantity: 4,
            },
            {
              attributes: { color: 'Blue', storage: '256GB' },
              id: 'variant-blue-256',
              merchant_id: 'merchant-1',
              price_override: 278_418.6,
              product_id: 'redmi-pad-2',
              stock_quantity: 6,
            },
          ],
        }}
        initialVariantSelection={{
          attributes: { color: 'Black', storage: '128GB' },
          variantId: 'variant-black-128',
        }}
        variantAxes={['storage']}
        variantCount={2}
      >
        <CriticalCommerceStateProbe />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('ready')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /select 256gb storage/i })
    );

    expect(screen.getByText('blocked')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).not.toHaveBeenCalled();
  });
});
