import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Product as RelatedProduct } from '@/lib/products';
import type { NormalizedProductDetails } from './product-details-helpers';
import type { ProductDetailsActiveTab } from './use-product-details-state';
import { DeferredProductDetailsSectionsLoader, type DeferredProductDetailsSectionsLoaderProps } from './deferred-product-details-sections-loader';

let mockDynamicState: 'success' | 'loading' | 'error' = 'success';

vi.mock('next/dynamic', () => {
  return {
    default: (
      loader: () => Promise<unknown>,
      options?: { loading?: () => ReactNode }
    ) => {
      const FallbackComponent = options?.loading || (() => null);
      return function MockDynamic(props: DeferredProductDetailsSectionsLoaderProps) {
        if (mockDynamicState === 'loading') {
          return <FallbackComponent />;
        }
        if (mockDynamicState === 'error') {
          return <div role="alert">Failed to load details</div>;
        }
        return (
          <section aria-label={`Deferred Details for ${props.productData?.name}`}>
            <h1>Mock Deferred Product Sections</h1>
            <p>{props.productData?.name}</p>
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
  it('renders the dynamic deferred product details sections when import succeeds', () => {
    mockDynamicState = 'success';

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const sections = screen.getByRole('region', {
      name: /deferred details for lenovo legion pro 9/i,
    });
    expect(sections).toBeInTheDocument();
    expect(sections).toHaveTextContent('Lenovo Legion Pro 9');
  });

  it('renders the loading fallback skeleton when dynamic import is pending', () => {
    mockDynamicState = 'loading';

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const skeleton = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('renders an error fallback when dynamic import fails', () => {
    mockDynamicState = 'error';

    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/failed to load details/i);
  });
});

