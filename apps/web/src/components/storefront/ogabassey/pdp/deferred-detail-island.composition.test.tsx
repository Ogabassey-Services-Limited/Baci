import { render, screen } from '@testing-library/react';
import { SafeHtml } from '@/components/ui/safe-html';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';
import { OgabasseyPdpDeferredTabsClient } from './deferred-tabs.client';
import type { OgabasseyPdpDeferredTabProduct } from './deferred-product-payload';

const mockUseViewportActivation = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

const productData = {
  brand: 'Lenovo',
  category: 'Laptops',
  colorImages: {},
  colors: [],
  condition: 'new',
  detailedSpecs: [],
  id: 'product-1',
  image: '/placeholder.png',
  images: ['/placeholder.png'],
  name: 'Lenovo Legion Pro 9',
  platforms: [],
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  rating: 0,
  reviewCount: 0,
  slug: 'lenovo-legion-pro-9',
  specs: [],
  storage: [],
} satisfies OgabasseyPdpDeferredTabProduct;

const descriptionSlot = (
  <SafeHtml html="<p>Creator laptop with RTX graphics.</p>" />
);

describe('OgabasseyPdpDeferredDetailClient description composition', () => {
  beforeEach(() => {
    mockUseViewportActivation.mockReset();
  });

  it('keeps the server description before activation and moves the same slot into the real Description tab', async () => {
    mockUseViewportActivation.mockReturnValue({
      isActive: false,
      ref: { current: null },
    });
    const { container, rerender } = render(
      <OgabasseyPdpDeferredDetailClient
        descriptionSlot={descriptionSlot}
        loadDetailsComponent={() =>
          Promise.resolve({
            OgabasseyPdpDeferredTabsClient,
          })
        }
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(
      screen.getByText('Creator laptop with RTX graphics.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /loading product details/i })
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-ogabassey-pdp-deferred-description-panel]')
    ).not.toBeNull();

    mockUseViewportActivation.mockReturnValue({
      isActive: true,
      ref: { current: null },
    });
    rerender(
      <OgabasseyPdpDeferredDetailClient
        descriptionSlot={descriptionSlot}
        loadDetailsComponent={() =>
          Promise.resolve({
            OgabasseyPdpDeferredTabsClient,
          })
        }
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(
      await screen.findByRole('tabpanel', { name: 'Description' })
    ).toHaveTextContent('Creator laptop with RTX graphics.');
    expect(screen.getAllByText('Creator laptop with RTX graphics.')).toHaveLength(1);
    expect(
      container.querySelector('[data-ogabassey-pdp-deferred-description-panel]')
    ).toBeNull();
  });

  it('keeps one server description in the stable panel when the real deferred loader rejects', async () => {
    mockUseViewportActivation.mockReturnValue({
      isActive: false,
      ref: { current: null },
    });
    const rejectingLoader = () => Promise.reject(new Error('chunk failed'));
    const { container, rerender } = render(
      <OgabasseyPdpDeferredDetailClient
        descriptionSlot={descriptionSlot}
        loadDetailsComponent={rejectingLoader}
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(screen.getAllByText('Creator laptop with RTX graphics.')).toHaveLength(1);
    expect(
      container.querySelector('[data-ogabassey-pdp-deferred-description-container]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-ogabassey-pdp-deferred-description-panel]')
    ).not.toBeNull();

    mockUseViewportActivation.mockReturnValue({
      isActive: true,
      ref: { current: null },
    });
    rerender(
      <OgabasseyPdpDeferredDetailClient
        descriptionSlot={descriptionSlot}
        loadDetailsComponent={rejectingLoader}
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /product details could not be loaded/i
    );
    expect(screen.getAllByText('Creator laptop with RTX graphics.')).toHaveLength(1);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-ogabassey-pdp-deferred-description-panel]')
    ).not.toBeNull();
  });

});
