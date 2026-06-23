import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as RelatedProduct } from '@/lib/products';
import { InlineProductRails } from './inline-product-rails';

const { brandProductsSpy, priceRangeProductsSpy } = vi.hoisted(() => ({
  brandProductsSpy: vi.fn(),
  priceRangeProductsSpy: vi.fn(),
}));

vi.mock('@/components/storefront/brand-products', () => ({
  BrandProducts: (props: { product?: { id?: string }; maxProducts: number }) => {
    brandProductsSpy(props);
    return (
      <section aria-label="Brand products">{`${props.product?.id ?? 'none'}:${props.maxProducts}`}</section>
    );
  },
}));

vi.mock('@/components/storefront/price-range-products', () => ({
  PriceRangeProducts: (props: {
    product?: { id?: string };
    maxProducts: number;
  }) => {
    priceRangeProductsSpy(props);
    return (
      <section aria-label="Price range products">{`${props.product?.id ?? 'none'}:${props.maxProducts}`}</section>
    );
  },
}));

describe('InlineProductRails', () => {
  it('renders brand and price-range rails for the related product', () => {
    const relatedProduct = { id: 'related-1' } as unknown as RelatedProduct;

    render(<InlineProductRails relatedProductsProduct={relatedProduct} />);

    expect(screen.getByLabelText('Brand products')).toHaveTextContent(
      'related-1:4'
    );
    expect(screen.getByLabelText('Price range products')).toHaveTextContent(
      'related-1:4'
    );
    expect(brandProductsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        maxProducts: 4,
        product: expect.objectContaining({ id: 'related-1' }),
      })
    );
    expect(priceRangeProductsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        maxProducts: 4,
        product: expect.objectContaining({ id: 'related-1' }),
      })
    );
  });
});
