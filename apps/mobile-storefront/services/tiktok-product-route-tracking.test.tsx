import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import type React from 'react';
import {
  AdTrackingRouteReadinessProvider,
  useTrackProductRouteViewed,
} from './tiktok-product-route-tracking';

const mockTrackProductViewed = jest.fn();
const mockTrackAddToCart = jest.fn();
const mockTrackAddToWishlist = jest.fn();

jest.mock('@/services/ad-tracking', () => ({
  trackAddToCart: (...args: unknown[]) => mockTrackAddToCart(...args),
  trackAddToWishlist: (...args: unknown[]) => mockTrackAddToWishlist(...args),
  trackProductViewed: (...args: unknown[]) => mockTrackProductViewed(...args),
}));

const product = {
  brand: 'OgaBassey',
  category: 'Phones',
  description: 'Clean iPhone',
  id: 'iphone-15',
  name: 'iPhone 15',
};

function ProductRouteTrackingProbe() {
  useTrackProductRouteViewed(product, 120000);
  return null;
}

function ReadinessWrapper({
  children,
  ready,
}: {
  children: React.ReactNode;
  ready: boolean;
}) {
  return (
    <AdTrackingRouteReadinessProvider ready={ready}>
      {children}
    </AdTrackingRouteReadinessProvider>
  );
}

describe('useTrackProductRouteViewed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks product views when no readiness provider is present', async () => {
    render(<ProductRouteTrackingProbe />);

    await waitFor(() => {
      expect(mockTrackProductViewed).toHaveBeenCalledWith({
        brand: 'OgaBassey',
        category: 'Phones',
        description: 'Clean iPhone',
        id: 'iphone-15',
        name: 'iPhone 15',
        price: 120000,
      });
    });
  });

  it('waits for route ad-tracking readiness before tracking once', async () => {
    const view = render(
      <ReadinessWrapper ready={false}>
        <ProductRouteTrackingProbe />
      </ReadinessWrapper>
    );

    expect(mockTrackProductViewed).not.toHaveBeenCalled();

    view.rerender(
      <ReadinessWrapper ready={true}>
        <ProductRouteTrackingProbe />
      </ReadinessWrapper>
    );

    await waitFor(() => {
      expect(mockTrackProductViewed).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <ReadinessWrapper ready={true}>
        <ProductRouteTrackingProbe />
      </ReadinessWrapper>
    );

    expect(mockTrackProductViewed).toHaveBeenCalledTimes(1);
  });
});
