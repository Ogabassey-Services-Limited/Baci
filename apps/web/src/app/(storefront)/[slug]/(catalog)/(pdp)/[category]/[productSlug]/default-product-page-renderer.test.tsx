import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';

const mockDefaultProductDetailClient = vi.hoisted(() =>
  vi.fn(({ product }: { product: Product }) => (
    <article aria-label="Default product detail">{product.name}</article>
  ))
);

vi.mock('./default-product-detail-client', () => ({
  DefaultProductDetailClient: (props: { product: Product }) =>
    mockDefaultProductDetailClient(props),
}));

import { DefaultProductPageRenderer } from './default-product-page-renderer';

function makeProduct(): Product {
  return {
    brand: 'HP',
    category: 'Laptops',
    category_slug: 'laptops',
    condition: 'new',
    description: 'A laptop',
    fulfillmentFields: [],
    gtin: '',
    id: 'product-1',
    image: '/hp.jpg',
    imageHint: 'hp laptop',
    imageLarge: '/hp.jpg',
    manage_stock: true,
    merchant_id: 'merchant-1',
    mpn: '',
    name: 'HP Laptop 14',
    price: 645_600,
    slug: 'hp-laptop-14',
    status: 'active',
    stock: 5,
  };
}

describe('DefaultProductPageRenderer', () => {
  it('renders the generic product client with semantic sections', () => {
    const semanticSections: ReactNode = (
      <section aria-label="Semantic product sections">
        Crawlable details
      </section>
    );

    render(
      <DefaultProductPageRenderer
        product={makeProduct()}
        semanticSections={semanticSections}
      />
    );

    expect(mockDefaultProductDetailClient).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({ name: 'HP Laptop 14' }),
      })
    );
    expect(
      screen.getByRole('article', { name: 'Default product detail' })
    ).toHaveTextContent('HP Laptop 14');
    expect(
      screen.getByRole('region', { name: 'Semantic product sections' })
    ).toHaveTextContent('Crawlable details');
  });
});
