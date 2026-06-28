import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { DeferredProductRails } from './deferred-product-rails';

const mockBrandProducts = vi.hoisted(() => vi.fn());
const mockPriceRangeProducts = vi.hoisted(() => vi.fn());
const relatedProduct = { id: 'related-1', name: 'Related' };

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

vi.mock('./related-product', () => ({
  toRelatedProductsProduct: vi.fn(() => relatedProduct),
}));

const product = {
  id: 'product-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
} as unknown as Product;

describe('DeferredProductRails', () => {
  beforeEach(() => {
    mockBrandProducts.mockReset();
    mockPriceRangeProducts.mockReset();
  });

  it('renders both rails with the derived related product', () => {
    render(<DeferredProductRails product={product} />);

    expect(screen.getByLabelText('Brand rail')).toBeInTheDocument();
    expect(screen.getByLabelText('Price rail')).toBeInTheDocument();
    expect(mockBrandProducts).toHaveBeenCalledWith(
      expect.objectContaining({ product: relatedProduct, maxProducts: 4 })
    );
    expect(mockPriceRangeProducts).toHaveBeenCalledWith(
      expect.objectContaining({ product: relatedProduct, maxProducts: 4 })
    );
  });
});
