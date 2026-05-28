import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import { OgabasseyPdpCriticalCommerce } from './critical-commerce';
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

const criticalProduct = {
  brand: 'Dell',
  categoryName: 'Laptops',
  categorySlug: 'laptops',
  condition: 'used',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/alienware.avif',
  name: 'Dell Alienware m18 R3 (RTX 5080)',
  price: 7_098_000,
  slug: 'dell-alienware-m18-r3-rtx-5080',
  stockQuantity: 4,
  variantCount: 1,
};

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
  price: 7_098_000,
  status: 'active',
  stock: 4,
};

describe('OgabasseyPdpCriticalCommerce', () => {
  it('renders static commerce facts before the client controls hydrate', () => {
    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        cartProduct={cartProduct}
        product={criticalProduct}
      />
    );

    expect(screen.getByText('Ready to buy')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add to cart/i })
    ).toBeInTheDocument();
  });
});

describe('OgabasseyPdpCriticalCommerceClient', () => {
  it('adds the selected quantity to the existing cart store', () => {
    render(
        <OgabasseyPdpCriticalCommerceClient
          cartHref="/cart"
          cartProduct={cartProduct}
          productName={cartProduct.name}
          variantCount={1}
        />
    );

    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(cartProduct, 2, {
      condition: 'used',
    });
    expect(cartMocks.setIsCartOpen).toHaveBeenCalledWith(true);
  });

  it('renders a variant hint and disables decrement at the default quantity', () => {
    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={cartProduct}
        productName={cartProduct.name}
        variantCount={2}
      />
    );

    expect(
      screen.getByText('Choose options below before checkout.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /decrease quantity/i })
    ).toBeDisabled();
  });

  it('omits cart condition options when the cart product has no condition', () => {
    const cartProductWithoutCondition = {
      ...cartProduct,
      condition: undefined,
    };

    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={cartProductWithoutCondition}
        productName={cartProduct.name}
        variantCount={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      cartProductWithoutCondition,
      2,
      undefined
    );
  });

  it('caps quantity increments at managed stock', () => {
    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={{
          ...cartProduct,
          stock: 2,
        }}
        productName={cartProduct.name}
        variantCount={1}
      />
    );

    const increaseButton = screen.getByRole('button', {
      name: /increase quantity/i,
    });
    fireEvent.click(increaseButton);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(increaseButton).toBeDisabled();
  });
});
