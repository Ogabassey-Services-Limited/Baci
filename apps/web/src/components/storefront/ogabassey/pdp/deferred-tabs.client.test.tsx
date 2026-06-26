import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpDeferredTabsClient } from './deferred-tabs.client';
import type { OgabasseyPdpDeferredTabProduct } from './deferred-product-payload';

const mockDeferredSections = vi.hoisted(() => vi.fn());

vi.mock(
  '@/components/storefront/ogabassey/pages/product-details-page/deferred-product-details-sections',
  () => ({
    DeferredProductDetailsSections: (props: unknown) => {
      mockDeferredSections(props);
      return <section aria-label="Deferred tab sections" />;
    },
  })
);

const productData = {
  brand: 'Apple',
  category: 'Accessories',
  categorySlug: 'accessories',
  colorImages: {},
  colors: [],
  condition: 'new',
  description: '20W USB-C Power Delivery adapter for supported devices.',
  detailedSpecs: [
    {
      category: 'Charging',
      items: [{ label: 'Power', value: '20W' }],
    },
  ],
  id: 'apple-charger',
  image: 'https://cdn.ogabassey.com/core-assets/products/apple-charger.avif',
  images: ['https://cdn.ogabassey.com/core-assets/products/apple-charger.avif'],
  name: 'Apple Fast Charger 20W',
  platforms: [],
  price: 'NGN 10,000',
  rawPrice: 10_000,
  rating: 4,
  reviewCount: 3,
  slug: 'apple-fast-charger-20w',
  specs: [{ label: 'Power', value: '20W' }],
  storage: [],
} satisfies OgabasseyPdpDeferredTabProduct;

function renderTabs(product: OgabasseyPdpDeferredTabProduct) {
  render(
    <OgabasseyPdpDeferredTabsClient
      productData={product}
      storeSlug="ogabassey"
    />
  );
}

function productWithRuntimeRating(
  rating: unknown
): OgabasseyPdpDeferredTabProduct {
  return {
    ...productData,
    rating: rating as OgabasseyPdpDeferredTabProduct['rating'],
  };
}

describe('OgabasseyPdpDeferredTabsClient', () => {
  beforeEach(() => {
    mockDeferredSections.mockReset();
  });

  it('renders below-fold tabs from compact product data without related rails', () => {
    renderTabs(productData);

    expect(mockDeferredSections).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: 'description',
        normalizedReviewRatingWidth: '80%',
        productData,
        showRails: false,
        storeSlug: 'ogabassey',
      })
    );
  });


  it('keeps deferred tabs inside the PDP content-width container', () => {
    renderTabs(productData);

    expect(screen.getByRole('region', { name: 'Deferred tab sections' }).parentElement).toHaveClass(
      'ogabassey-pdp-deferred-tabs-container'
    );
  });

  it('clamps out-of-range review ratings to a full-width score', () => {
    renderTabs({ ...productData, rating: 9 });

    expect(mockDeferredSections).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedReviewRatingWidth: '100%',
      })
    );
  });

  it('normalizes missing review ratings to an empty score', () => {
    renderTabs(productWithRuntimeRating(undefined));

    expect(mockDeferredSections).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedReviewRatingWidth: '0%',
      })
    );
  });

  it('normalizes non-numeric review ratings to an empty score', () => {
    renderTabs(productWithRuntimeRating('unrated'));

    expect(mockDeferredSections).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedReviewRatingWidth: '0%',
      })
    );
  });
});
