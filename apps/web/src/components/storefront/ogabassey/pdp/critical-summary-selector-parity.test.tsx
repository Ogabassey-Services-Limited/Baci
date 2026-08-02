import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import { buildOgabasseyProductVisibleSummary } from './build-product-visible-summary';
import {
  OgabasseyPdpCriticalCommerceProvider,
  OgabasseyPdpCriticalCommerceSummary,
} from './critical-commerce.client';
import { OgabasseyPdpProductVisibleSummary } from './product-visible-summary';

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({ addToCart: vi.fn(), setIsCartOpen: vi.fn() }),
}));

const cartProduct: CartProduct = {
  brand: 'HP',
  condition: 'new',
  description: 'HP Laptop 14-ep0063nia',
  gtin: '',
  id: 'product-1',
  image: '/placeholder.png',
  imageHint: 'HP Laptop 14-ep0063nia',
  imageLarge: '/placeholder.png',
  manage_stock: true,
  mpn: 'hp-laptop-14-ep0063nia',
  name: 'HP Laptop 14-ep0063nia',
  offers: [
    {
      condition: 'used',
      id: 'offer-used',
      price: 500000,
      stock_quantity: 1,
    },
  ],
  price: 645600,
  status: 'active',
  stock: 1,
};

describe('critical summary selector parity', () => {
  it('does not claim a condition-offer choice when the real selector has no variants', () => {
    const summary = buildOgabasseyProductVisibleSummary({
      brand: cartProduct.brand,
      condition: cartProduct.condition,
      name: cartProduct.name,
      ...( { offers: cartProduct.offers } as object),
      variants: [],
    });

    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={cartProduct}
        variantCount={0}
      >
        <OgabasseyPdpProductVisibleSummary summary={summary} />
        <OgabasseyPdpCriticalCommerceSummary />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(
      screen.queryByText(/Available choices: Condition New or Used/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /select .* condition/i })
    ).not.toBeInTheDocument();
  });
});
