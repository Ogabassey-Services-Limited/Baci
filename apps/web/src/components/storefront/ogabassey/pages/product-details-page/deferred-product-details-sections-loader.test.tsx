import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { type ReactNode, useEffect } from 'react';
import type { Product as RelatedProduct } from '@/lib/products';
import type { NormalizedProductDetails } from './product-details-helpers';
import type { ProductDetailsActiveTab } from './use-product-details-state';
import { DeferredProductDetailsSectionsLoader, type DeferredProductDetailsSectionsLoaderProps } from './deferred-product-details-sections-loader';

let mockDynamicState: 'success' | 'loading' | 'error' = 'success';
const mockUseViewportActivation = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

vi.mock('next/dynamic', () => {
  return {
    default: (
      loader: () => Promise<unknown>,
      options?: { loading?: () => ReactNode }
    ) => {
      const FallbackComponent = options?.loading || (() => null);
      return function MockDynamic(
        props: DeferredProductDetailsSectionsLoaderProps & { onLoaded?: () => void }
      ) {
        const { onLoaded, ...restProps } = props;

        useEffect(() => {
          if (mockDynamicState === 'success') {
            onLoaded?.();
          }
        }, [onLoaded]);

        if (mockDynamicState === 'loading') {
          return <FallbackComponent />;
        }
        if (mockDynamicState === 'error') {
          return <div role="alert">Failed to load details</div>;
        }
        return (
          <section aria-label={`Deferred Details for ${restProps.productData?.name}`}>
            <h1>Mock Deferred Product Sections</h1>
            <p>{restProps.productData?.name}</p>
          </section>
        );
      };
    },
  };
});

const baseProps = {
  activeTab: 'description' as ProductDetailsActiveTab,
  normalizedReviewRatingWidth: '80%',
  onSelectTab: vi.fn(),
  productData: {
    name: 'Lenovo Legion Pro 9',
    videoUrl: null,
  } as unknown as NormalizedProductDetails,
  relatedProductsProduct: { id: 'related-1' } as unknown as RelatedProduct,
  storeSlug: 'ogabassey',
};

describe('DeferredProductDetailsSectionsLoader', () => {
  beforeEach(() => {
    mockUseViewportActivation.mockReset();
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: false,
    });
  });

  it('renders only the loading fallback skeleton when the viewport is NOT active', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: false,
    });

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const wrapper = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-busy', 'true');

    // Dynamic component should not be rendered
    expect(
      screen.queryByRole('region', {
        name: /deferred details for lenovo legion pro 9/i,
      })
    ).not.toBeInTheDocument();
  });

  it('renders the dynamic deferred product details sections when the viewport IS active', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });
    mockDynamicState = 'success';

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const sections = screen.getByRole('region', {
      name: /deferred details for lenovo legion pro 9/i,
    });
    expect(sections).toBeInTheDocument();
    expect(sections).toHaveTextContent('Lenovo Legion Pro 9');

    // Stable parent wrapper should have aria-busy="false"
    const wrapper = screen.getByRole('status', {
      name: /product details loaded/i,
    });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-busy', 'false');
  });

  it('renders the loading fallback skeleton when dynamic import is pending and viewport IS active', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });
    mockDynamicState = 'loading';

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const wrapper = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-busy', 'true');
  });

  it('renders an error fallback when dynamic import fails and viewport IS active', () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });
    mockDynamicState = 'error';

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/failed to load details/i);
  });
});


