import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as RelatedProduct } from '@/lib/products';
import type { NormalizedProductDetails } from './product-details-helpers';
import { DeferredProductDetailsSections } from './deferred-product-details-sections';
import type { ProductDetailsActiveTab } from './use-product-details-state';

vi.mock('../../components/AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div data-testid={`adunit-${placementKey}`} />
  ),
}));

vi.mock('../../components/ProductVideo', () => ({
  ProductVideo: ({ title }: { title: string }) => (
    <div data-testid="product-video">{title}</div>
  ),
}));

vi.mock('./product-details-tabs', () => ({
  ProductDetailsTabs: ({
    storeSlug,
    productData,
  }: {
    storeSlug: string;
    productData: { name: string };
  }) => <div data-testid="product-details-tabs">{`${storeSlug}:${productData.name}`}</div>,
}));

vi.mock('@/components/storefront/brand-products', () => ({
  BrandProducts: () => <div data-testid="brand-products" />,
}));

vi.mock('@/components/storefront/price-range-products', () => ({
  PriceRangeProducts: () => <div data-testid="price-range-products" />,
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

    expect(screen.getByTestId('adunit-CONTENT_BREAK')).toBeInTheDocument();
    expect(screen.getByTestId('product-details-tabs')).toHaveTextContent(
      'ogabassey:Lenovo Legion Pro 9'
    );
    expect(screen.getByTestId('product-video')).toHaveTextContent(
      'Lenovo Legion Pro 9'
    );
    expect(screen.getByTestId('brand-products')).toBeInTheDocument();
    expect(screen.getByTestId('price-range-products')).toBeInTheDocument();
  });

  it('skips product video when no video id exists', () => {
    renderDeferredSections({
      name: 'Lenovo Legion Pro 9',
      videoUrl: null,
    } as unknown as NormalizedProductDetails);

    expect(screen.queryByTestId('product-video')).toBeNull();
  });
});
