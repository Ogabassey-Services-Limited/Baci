import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpBelowFoldIsland } from './client-islands';

const { mockDeferredDetailIsland } = vi.hoisted(() => ({
  mockDeferredDetailIsland: vi.fn(),
}));

vi.mock('./deferred-detail-island', () => ({
  OgabasseyPdpDeferredDetailIsland: (props: {
    product: { name: string };
    semanticSections?: ReactNode;
  }) => {
    mockDeferredDetailIsland(props);
    return <section aria-label="Product details">{props.semanticSections}</section>;
  },
}));

const product = {
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  name: 'Lenovo Legion Pro 9',
  price: '₦5,985,000',
  rawPrice: 5_985_000,
  slug: 'lenovo-legion-pro-9',
} as unknown as Product;

describe('OgaBassey PDP client islands', () => {
  it('renders below-fold semantic content through the deferred detail island', () => {
    render(
      <OgabasseyPdpBelowFoldIsland
        product={product}
        semanticSections={<section aria-label="Related buying guidance" />}
      />
    );

    expect(mockDeferredDetailIsland).toHaveBeenCalledWith(
      expect.objectContaining({
        product,
        semanticSections: expect.anything(),
      })
    );
    expect(screen.getByLabelText('Related buying guidance')).toBeInTheDocument();
  });
});
