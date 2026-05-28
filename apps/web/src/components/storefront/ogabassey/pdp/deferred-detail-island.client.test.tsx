import { render, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';

const mockUseViewportActivation = vi.hoisted(() => vi.fn());
const mockProductDetailsPage = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<unknown>,
    options?: { loading?: () => ReactNode }
  ) => {
    const FallbackComponent = options?.loading || (() => null);
    return function MockDynamic(props: { mode?: string; product: Product }) {
      useEffect(() => {
        void loader();
      }, [loader]);

      if (!props.product) {
        return <FallbackComponent />;
      }

      mockProductDetailsPage(props);
      return <section aria-label="Deferred product details">{props.mode}</section>;
    };
  },
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: () => null,
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

  it('does not render ProductDetailsPage before viewport activation', () => {
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

  it('renders below-fold ProductDetailsPage after viewport activation', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });

    render(<OgabasseyPdpDeferredDetailClient product={product} />);

    expect(mockProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'belowFold', product })
    );
  });
});
