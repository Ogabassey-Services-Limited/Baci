import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { DeferredProductRails } from './deferred-product-rails';

const mockBrandProducts = vi.hoisted(() => vi.fn());
const mockPriceRangeProducts = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/brand-products', () => ({
  BrandProducts: (props: { product: unknown }) => {
    mockBrandProducts(props);
    return <div aria-label="Brand rail">brand</div>;
  },
}));

vi.mock('@/components/storefront/price-range-products', () => ({
  PriceRangeProducts: (props: { product: unknown }) => {
    mockPriceRangeProducts(props);
    return <div aria-label="Price rail">price</div>;
  },
}));

const product = {
  brand: 'Apple',
  description: 'Apple smartphone',
  gtin: '',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/iphone-15.avif',
  imageHint: 'iPhone 15',
  imageLarge: 'https://cdn.ogabassey.com/core-assets/products/iphone-15.avif',
  manage_stock: true,
  merchant_id: 'merchant-1',
  mpn: '',
  name: 'iPhone 15',
  price: 500_000,
  slug: 'iphone-15',
  status: 'active',
  stock: 5,
} satisfies Product;

describe('DeferredProductRails', () => {
  beforeEach(() => {
    mockBrandProducts.mockReset();
    mockPriceRangeProducts.mockReset();
  });

  it('renders both rails with the product passed directly', () => {
    render(<DeferredProductRails product={product} />);

    expect(screen.getByLabelText('Brand rail')).toBeInTheDocument();
    expect(screen.getByLabelText('Price rail')).toBeInTheDocument();
    expect(mockBrandProducts).toHaveBeenCalledWith(
      expect.objectContaining({ product, maxProducts: 4 })
    );
    expect(mockPriceRangeProducts).toHaveBeenCalledWith(
      expect.objectContaining({ product, maxProducts: 4 })
    );
  });
});
