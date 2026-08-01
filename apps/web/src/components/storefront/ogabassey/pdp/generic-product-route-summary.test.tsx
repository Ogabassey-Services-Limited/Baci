import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { GenericProductRouteSummary } from './generic-product-route-summary';

vi.mock('@/lib/storefront-product-price-seo', () => ({
  buildProductPriceSeoCopy: () => ({
    answer: 'Buy the HP Laptop 14-ep0063nia today.',
    priceText: 'NGN 645,600',
  }),
}));

const product = {
  brand: 'HP',
  category: 'Laptops',
  condition: 'new',
  description: '<p>Reliable <strong>work</strong> laptop.</p>',
  id: 'product-1',
  name: 'HP Laptop 14-ep0063nia',
  price: 645600,
} as Product;

describe('GenericProductRouteSummary', () => {
  it('preserves the legacy generic hidden summary fields', () => {
    render(
      <GenericProductRouteSummary
        currency="NGN"
        merchant={{ business_name: 'TestStore', country: 'NG' }}
        product={product}
      />
    );

    const summary = screen.getByLabelText('HP Laptop 14-ep0063nia summary');
    expect(summary).toHaveClass('sr-only');
    expect(summary).toHaveTextContent('Buy the HP Laptop 14-ep0063nia today.');
    expect(summary).toHaveTextContent('Reliable work laptop.');
    expect(summary).toHaveTextContent('BrandHP');
    expect(summary).toHaveTextContent('CategoryLaptops');
    expect(summary).toHaveTextContent('Conditionnew');
    expect(summary).toHaveTextContent('PriceNGN 645,600');
  });

  it('keeps price and product metadata when the description is empty', () => {
    render(
      <GenericProductRouteSummary
        currency="NGN"
        merchant={{ business_name: 'TestStore', country: 'NG' }}
        product={{ ...product, description: '' }}
      />
    );

    const summary = screen.getByLabelText('HP Laptop 14-ep0063nia summary');
    expect(summary).toHaveTextContent('Buy the HP Laptop 14-ep0063nia today.');
    expect(summary).toHaveTextContent('BrandHP');
    expect(summary).toHaveTextContent('PriceNGN 645,600');
    expect(summary).not.toHaveTextContent('Reliable work laptop.');
  });
});
