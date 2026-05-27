import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import {
  OgabasseyPdpBelowFoldIsland,
  OgabasseyPdpCommerceIsland,
} from './client-islands';

const { mockProductDetailsPage } = vi.hoisted(() => ({
  mockProductDetailsPage: vi.fn(),
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: (props: {
    mode?: string;
    product: { name: string };
    semanticSections?: ReactNode;
  }) => {
    mockProductDetailsPage(props);
    if (props.mode === 'commerce') {
      return <button type="button">Add to Cart</button>;
    }

    return <section>{props.semanticSections}</section>;
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
  it('renders commerce controls without duplicating product heading or image', () => {
    const { container } = render(
      <OgabasseyPdpCommerceIsland product={product} />
    );

    expect(mockProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'commerce', product })
    );
    expect(
      screen.getByRole('button', { name: 'Add to Cart' })
    ).toBeInTheDocument();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders below-fold document content in belowFold mode', () => {
    render(
      <OgabasseyPdpBelowFoldIsland
        product={product}
        semanticSections={<section aria-label="Related buying guidance" />}
      />
    );

    expect(mockProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'belowFold',
        product,
        semanticSections: expect.anything(),
      })
    );
    expect(screen.getByLabelText('Related buying guidance')).toBeInTheDocument();
  });
});
