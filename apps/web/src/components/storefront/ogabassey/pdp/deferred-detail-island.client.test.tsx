import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';
import type { OgabasseyPdpDeferredTabProduct } from './deferred-product-payload';

const mockUseViewportActivation = vi.hoisted(() => vi.fn());
const mockDeferredTabsClient = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

// The component lazy-loads this smaller module via runtime import() once active.
vi.mock('./deferred-tabs.client', () => ({
  OgabasseyPdpDeferredTabsClient: (props: {
    productData: OgabasseyPdpDeferredTabProduct;
    storeSlug: string;
  }) => {
    mockDeferredTabsClient(props);
    return <section aria-label="Deferred product details">tabs</section>;
  },
}));

const productData = {
  brand: 'Lenovo',
  category: 'Laptops',
  colorImages: {},
  colors: [],
  condition: 'new',
  description: 'Creator laptop with RTX graphics.',
  detailedSpecs: [],
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  images: ['https://cdn.ogabassey.com/core-assets/products/legion.avif'],
  name: 'Lenovo Legion Pro 9',
  platforms: [],
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  rating: 0,
  reviewCount: 0,
  slug: 'lenovo-legion-pro-9',
  specs: [],
  storage: [],
} as OgabasseyPdpDeferredTabProduct;

describe('OgabasseyPdpDeferredDetailClient', () => {
  beforeEach(() => {
    mockDeferredTabsClient.mockReset();
    mockUseViewportActivation.mockReset();
  });

  it('does not import or render deferred tabs before viewport activation', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: false,
    });

    render(
      <OgabasseyPdpDeferredDetailClient
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(mockDeferredTabsClient).not.toHaveBeenCalled();
    expect(
      screen.getByRole('status', { name: /loading product details/i })
    ).toBeInTheDocument();
  });

  it('does not render an empty description panel before deferred tabs activate', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: false,
    });

    const { container } = render(
      <OgabasseyPdpDeferredDetailClient
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(
      container.querySelector('[data-ogabassey-pdp-deferred-description-container]')
    ).toBeNull();
    expect(
      screen.getByRole('status', { name: /loading product details/i })
    ).toBeInTheDocument();
  });

  it('renders a recoverable error state when the details chunk fails to load', async () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });

    render(
      <OgabasseyPdpDeferredDetailClient
        descriptionSlot={<p>Persistent server description.</p>}
        loadDetailsComponent={() => Promise.reject(new Error('chunk failed'))}
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/product details could not be loaded/i);
    expect(screen.getAllByText('Persistent server description.')).toHaveLength(1);
    expect(mockDeferredTabsClient).not.toHaveBeenCalled();
  });

  it('lazy-loads + renders compact tabs after viewport activation', async () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });

    render(
      <OgabasseyPdpDeferredDetailClient
        productData={productData}
        storeSlug="ogabassey"
      />
    );

    expect(
      await screen.findByRole('region', { name: /deferred product details/i })
    ).toBeInTheDocument();
    expect(mockDeferredTabsClient).toHaveBeenCalledWith(
      expect.objectContaining({ productData, storeSlug: 'ogabassey' })
    );
  });
});
