import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as RelatedProduct } from '@/lib/products';
import type { NormalizedProductDetails } from './product-details-helpers';
import { DeferredProductDetailsSections } from './deferred-product-details-sections';
import type { ProductDetailsActiveTab } from './use-product-details-state';

vi.mock('../../components/AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div role="region" aria-label={`Ad Unit ${placementKey}`} />
  ),
}));

vi.mock('../../components/ProductVideo', () => ({
  ProductVideo: ({ title }: { title: string }) => (
    <div role="region" aria-label="Product video">
      {title}
    </div>
  ),
}));

vi.mock('./product-details-tabs', () => ({
  ProductDetailsTabs: ({
    storeSlug,
    productData,
  }: {
    storeSlug: string;
    productData: { name: string };
  }) => (
    <div role="region" aria-label="Product details tabs">
      {`${storeSlug}:${productData.name}`}
    </div>
  ),
}));

vi.mock('@/components/storefront/brand-products', () => ({
  BrandProducts: () => <div role="region" aria-label="Brand products" />,
}));

vi.mock('@/components/storefront/price-range-products', () => ({
  PriceRangeProducts: () => (
    <div role="region" aria-label="Price range products" />
  ),
}));

function renderDeferredSections(productData: NormalizedProductDetails) {
  const relatedProduct = { id: 'related-1' } as unknown as RelatedProduct;
  const handleSelectTab = (_tab: ProductDetailsActiveTab) => {};

  return render(
    <DeferredProductDetailsSections
      activeTab="description"
      normalizedReviewRatingWidth="80%"
      onSelectTab={handleSelectTab}
      productData={productData}
      relatedProductsProduct={relatedProduct}
      storeSlug="ogabassey"
    />
  );
}

describe('DeferredProductDetailsSections', () => {
  it('renders deferred merchandising sections and video when present', () => {
    renderDeferredSections({
      name: 'Lenovo Legion Pro 9',
      videoUrl: 'video-id-123',
    } as unknown as NormalizedProductDetails);

    expect(
      screen.getByRole('region', { name: 'Ad Unit CONTENT_BREAK' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Product details tabs' })
    ).toHaveTextContent(
      'ogabassey:Lenovo Legion Pro 9'
    );
    expect(screen.getByRole('region', { name: 'Product video' })).toHaveTextContent(
      'Lenovo Legion Pro 9'
    );
    expect(
      screen.getByRole('region', { name: 'Brand products' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Price range products' })
    ).toBeInTheDocument();
  });

  it('skips product video when no video id exists', () => {
    renderDeferredSections({
      name: 'Lenovo Legion Pro 9',
      videoUrl: null,
    } as unknown as NormalizedProductDetails);

    expect(screen.queryByRole('region', { name: 'Product video' })).toBeNull();
  });
});
