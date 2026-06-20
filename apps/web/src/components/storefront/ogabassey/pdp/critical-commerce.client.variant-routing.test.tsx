import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import { OgabasseyPdpCriticalCommerceClient } from './critical-commerce.client';

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

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const cartProduct: CartProduct = {
  brand: 'Dell',
  condition: 'used',
  description: 'Dell Alienware m18 R3 (RTX 5080)',
  gtin: '',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/alienware.avif',
  imageHint: 'Dell Alienware m18 R3 (RTX 5080)',
  imageLarge: 'https://cdn.ogabassey.com/alienware.avif',
  manage_stock: true,
  mpn: 'dell-alienware-m18-r3-rtx-5080',
  name: 'Dell Alienware m18 R3 (RTX 5080)',
  price: 237_674.42,
  status: 'active',
  stock: 4,
};

const variantCartProduct: CartProduct = {
  ...cartProduct,
  has_variants: true,
  variants: [
    {
      attributes: { ram: '4GB', storage: '128GB' },
      id: 'variant-128-4',
      merchant_id: 'merchant-1',
      price_override: 237_674.42,
      product_id: 'product-1',
      stock_quantity: 10,
    },
    {
      attributes: { ram: '8GB', storage: '256GB' },
      id: 'variant-256-8',
      merchant_id: 'merchant-1',
      price_override: 278_418.6,
      product_id: 'product-1',
      stock_quantity: 8,
    },
  ],
};

beforeEach(() => {
  cartMocks.addToCart.mockClear();
  cartMocks.setIsCartOpen.mockClear();
  document
    .querySelector('#ogabassey-pdp-variant-selectors-product-1')
    ?.remove();
  document.querySelector('#ogabassey-pdp-price-product-1')?.remove();
});

describe('OgabasseyPdpCriticalCommerceClient variant routing', () => {
  it('mounts selector buttons in the summary slot without duplicating them in purchase controls', () => {
    const summarySlot = document.createElement('div');
    summarySlot.id = 'ogabassey-pdp-variant-selectors-product-1';
    summarySlot.setAttribute('aria-label', 'Product variant selector slot');
    summarySlot.setAttribute('role', 'group');
    document.body.append(summarySlot);

    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={variantCartProduct}
        productName={variantCartProduct.name}
        variantAxes={['storage', 'ram']}
        variantCount={2}
        variantSelectorPortalTargetId="ogabassey-pdp-variant-selectors-product-1"
      />
    );

    const summarySlotGroup = screen.getByRole('group', {
      name: /product variant selector slot/i,
    });
    expect(
      within(summarySlotGroup).getByRole('button', {
        name: /select 128gb storage/i,
      })
    ).toBeInTheDocument();

    const commerceControls = screen.getByRole('group', {
      name: /purchase controls/i,
    });
    expect(
      within(commerceControls).queryByRole('button', {
        name: /select 128gb storage/i,
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(summarySlotGroup).getByRole('button', {
        name: /select 256gb storage/i,
      })
    );
    fireEvent.click(
      within(summarySlotGroup).getByRole('button', {
        name: /select 8gb ram/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 278_418.6,
      }),
      1,
      expect.objectContaining({
        variantId: 'variant-256-8',
      })
    );
  });

  it('seeds selectors and the summary price from a valid variant link', () => {
    const priceSlot = document.createElement('span');
    priceSlot.id = 'ogabassey-pdp-price-product-1';
    priceSlot.setAttribute('aria-label', 'Product price');
    priceSlot.setAttribute('role', 'status');
    document.body.append(priceSlot);

    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={variantCartProduct}
        initialVariantSelection={{
          attributes: { ram: '8GB', storage: '256GB' },
          variantId: 'variant-256-8',
        }}
        pricePortalTargetId="ogabassey-pdp-price-product-1"
        productName={variantCartProduct.name}
        variantAxes={['storage', 'ram']}
        variantCount={2}
      />
    );

    expect(
      screen.getByRole('button', { name: /select 256gb storage/i })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /select 8gb ram/i })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('status', { name: /product price/i })
    ).toHaveTextContent(/278,419/);

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 278_418.6,
      }),
      1,
      expect.objectContaining({
        variantId: 'variant-256-8',
      })
    );
  });

  it('requires an explicit hidden color selection before adding color-only variants', () => {
    const colorVariantProduct: CartProduct = {
      ...variantCartProduct,
      variants: [
        {
          attributes: { color: 'Black' },
          id: 'variant-black',
          merchant_id: 'merchant-1',
          price_override: 237_674.42,
          product_id: 'product-1',
          stock_quantity: 10,
        },
        {
          attributes: { color: 'Blue' },
          id: 'variant-blue',
          merchant_id: 'merchant-1',
          price_override: 240_000,
          product_id: 'product-1',
          stock_quantity: 8,
        },
      ],
    };

    const { unmount } = render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={colorVariantProduct}
        productName={colorVariantProduct.name}
        variantAxes={[]}
        variantCount={2}
      />
    );

    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
    unmount();

    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={colorVariantProduct}
        initialVariantSelection={{
          attributes: { color: 'Blue' },
          variantId: 'variant-blue',
        }}
        productName={colorVariantProduct.name}
        variantAxes={[]}
        variantCount={2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 240_000,
      }),
      1,
      expect.objectContaining({
        color: 'Blue',
        variantId: 'variant-blue',
      })
    );
  });
});
