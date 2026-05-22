import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as RelatedProduct } from '@/lib/products';
import type { NormalizedProductDetails } from './product-details-helpers';
import type { ProductDetailsActiveTab } from './use-product-details-state';
import { DeferredProductDetailsSectionsLoader } from './deferred-product-details-sections-loader';

vi.mock('next/dynamic', () => {
  return {
    default: (loader: () => Promise<unknown>) => {
      return function MockDynamic(props: any) {
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
  it('renders the dynamic deferred product details sections and passes props correctly', () => {
    render(<DeferredProductDetailsSectionsLoader {...baseProps} />);

    const sections = screen.getByRole('region', {
      name: /deferred details for lenovo legion pro 9/i,
    });
    expect(sections).toBeInTheDocument();
    expect(sections).toHaveTextContent('Lenovo Legion Pro 9');
  });
});
