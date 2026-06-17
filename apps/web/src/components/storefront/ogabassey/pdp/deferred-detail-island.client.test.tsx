import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';

const mockUseViewportActivation = vi.hoisted(() => vi.fn());
const mockProductDetailsPage = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

// The component lazy-loads this module via runtime import() once active.
vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: (props: { mode?: string; product: Product }) => {
    mockProductDetailsPage(props);
    return (
      <section aria-label="Deferred product details">{props.mode}</section>
    );
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

describe('OgabasseyPdpDeferredDetailClient', () => {
  beforeEach(() => {
    mockProductDetailsPage.mockReset();
    mockUseViewportActivation.mockReset();
  });

  it('does not import or render ProductDetailsPage before viewport activation', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: false,
    });

    render(<OgabasseyPdpDeferredDetailClient product={product} />);

    expect(mockProductDetailsPage).not.toHaveBeenCalled();
    expect(
      screen.getByRole('status', { name: /loading product details/i })
    ).toBeInTheDocument();
  });

  it('lazy-loads + renders below-fold ProductDetailsPage after viewport activation', async () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });

    render(<OgabasseyPdpDeferredDetailClient product={product} />);

    // The runtime import() resolves asynchronously, then the island re-renders
    // with the real (mocked) details component.
    expect(
      await screen.findByRole('region', { name: /deferred product details/i })
    ).toBeInTheDocument();
    expect(mockProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'belowFold', product })
    );
  });
});
