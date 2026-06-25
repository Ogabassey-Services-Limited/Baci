import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredRailsIsland } from './deferred-rails-island.client';

const mockUseViewportActivation = vi.hoisted(() => vi.fn());
const mockDeferredProductRails = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

vi.mock(
  '@/components/storefront/ogabassey/pages/product-details-page/deferred-product-rails',
  () => ({
    DeferredProductRails: (props: { product: Product }) => {
      mockDeferredProductRails(props);
      return <div aria-label="Related product rails">rails</div>;
    },
  })
);

const product = {
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  name: 'Lenovo Legion Pro 9',
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  slug: 'lenovo-legion-pro-9',
} as unknown as Product;

describe('OgabasseyPdpDeferredRailsIsland', () => {
  beforeEach(() => {
    mockDeferredProductRails.mockReset();
    mockUseViewportActivation.mockReset();
  });

  it('does not import or render the rails before viewport activation', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: false,
    });

    render(<OgabasseyPdpDeferredRailsIsland product={product} />);

    expect(mockDeferredProductRails).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('region', { name: /related product rails/i })
    ).not.toBeInTheDocument();
  });

  it('renders nothing when the rails chunk fails to load', async () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });

    const { container } = render(
      <OgabasseyPdpDeferredRailsIsland
        loadRailsComponent={() => Promise.reject(new Error('chunk failed'))}
        product={product}
      />
    );

    // The activation effect rejects across several microtasks; wait for the
    // island to settle empty (no rails, no crash) rather than a single tick.
    await waitFor(() => {
      expect(
        container.querySelector('[data-ogabassey-pdp-deferred-rails]')
      ).toBeEmptyDOMElement();
    });
    expect(mockDeferredProductRails).not.toHaveBeenCalled();
  });

  it('lazy-loads + renders the rails after viewport activation', async () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });

    render(<OgabasseyPdpDeferredRailsIsland product={product} />);

    expect(
      await screen.findByLabelText('Related product rails')
    ).toBeInTheDocument();
    expect(mockDeferredProductRails).toHaveBeenCalledWith(
      expect.objectContaining({ product })
    );
  });
});
