import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailIsland } from './deferred-detail-island';

const mockDeferredDetailClient = vi.hoisted(() => vi.fn());

vi.mock('./deferred-detail-island.client', () => ({
  OgabasseyPdpDeferredDetailClient: (props: { product: Product }) => {
    mockDeferredDetailClient(props);
    return <section aria-label="Deferred product detail client" />;
  },
}));

const product = {
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  name: 'Lenovo Legion Pro 9',
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  slug: 'lenovo-legion-pro-9',
} as unknown as Product;

describe('OgabasseyPdpDeferredDetailIsland', () => {
  it('keeps semantic sections server-rendered and forwards the product to the deferred client', () => {
    const { container } = render(
      <OgabasseyPdpDeferredDetailIsland
        product={product}
        semanticSections={<section aria-label="Buying guidance" />}
      />
    );

    expect(
      screen.getByRole('region', { name: 'Product details' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Buying guidance')).toBeInTheDocument();
    expect(
      container.querySelector('[data-ogabassey-pdp-semantics]')
    ).not.toBeNull();
    expect(mockDeferredDetailClient).toHaveBeenCalledWith({ product });
  });

  it('renders without semantic sections', () => {
    render(<OgabasseyPdpDeferredDetailIsland product={product} />);

    expect(
      screen.getByRole('region', { name: 'Product details' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Deferred product detail client' })
    ).toBeInTheDocument();
  });
});
