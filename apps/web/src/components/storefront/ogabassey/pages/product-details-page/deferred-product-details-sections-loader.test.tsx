import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product as RelatedProduct } from '@/lib/products';
import type { NormalizedProductDetails } from './product-details-helpers';
import type { ProductDetailsActiveTab } from './use-product-details-state';
import { DeferredProductDetailsSectionsLoader } from './deferred-product-details-sections-loader';

const mockUseViewportActivation = vi.hoisted(() => vi.fn());

vi.mock('@/components/storefront/use-viewport-activation', () => ({
  useViewportActivation: mockUseViewportActivation,
}));

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

  it('does not import below-fold product details before viewport activation', () => {
    const loadDeferredSections = vi.fn();

    render(
      <DeferredProductDetailsSectionsLoader
        {...baseProps}
        loadDeferredSections={loadDeferredSections}
      />
    );

    expect(loadDeferredSections).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('deferred-product-details-placeholder')
    ).toBeInTheDocument();
  });

  it('imports and renders the details section after viewport activation', async () => {
    mockUseViewportActivation.mockReturnValue({
      ref: { current: null },
      isActive: true,
    });
    const loadDeferredSections = vi.fn().mockResolvedValue({
      DeferredProductDetailsSections: ({
        productData,
      }: {
        productData: { name: string };
      }) => (
        <section aria-label="Loaded product details">{productData.name}</section>
      ),
    });

    render(
      <DeferredProductDetailsSectionsLoader
        {...baseProps}
        loadDeferredSections={loadDeferredSections}
      />
    );

    await waitFor(() => expect(loadDeferredSections).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole('region', { name: 'Loaded product details' })
    ).toHaveTextContent('Lenovo Legion Pro 9');
  });
});
