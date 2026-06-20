import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import { OgabasseyPdpCriticalCommerce } from './critical-commerce';

vi.mock('./critical-commerce.client', () => ({
  OgabasseyPdpCriticalCommerceClient: () => (
    <button type="button">Add to cart</button>
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

  it('omits the condition fact when the product condition is missing', () => {
    const productWithoutCondition = {
      ...criticalProduct,
      condition: undefined,
    } as unknown as typeof criticalProduct;

    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        cartProduct={{
          ...cartProduct,
          condition: undefined,
        }}
        product={productWithoutCondition}
      />
    );

    expect(screen.queryByText('Condition')).not.toBeInTheDocument();
    expect(screen.getByText('Lagos and nationwide')).toBeInTheDocument();
  });

  it('formats underscored product conditions for display', () => {
    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        cartProduct={{
          ...cartProduct,
          condition: 'open_box',
        }}
        product={{
          ...criticalProduct,
          condition: 'open_box',
        }}
      />
    );

    expect(screen.getByText('Open Box')).toBeInTheDocument();
    expect(screen.queryByText('Open_box')).not.toBeInTheDocument();
  });
});
