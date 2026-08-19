import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductDetailsPageOverlays } from './product-details-page-overlays';
import type { NormalizedProductDetails } from './product-normalization';

vi.mock('./product-details-lazy-fly-to-cart-animation', () => ({
  FlyToCartAnimation: () => <div data-testid="fly-to-cart" />,
}));
vi.mock('./product-details-lazy-selection-required-modal', () => ({
  SelectionRequiredModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="selection-required-modal" /> : null,
}));
vi.mock('./product-details-lazy-negotiation-modal', () => ({
  NegotiationModal: () => <div data-testid="negotiation-modal" />,
}));

const overlayProductData = {
  brand: 'Samsung',
  id: 'product-1',
  images: ['https://cdn.example.com/phone.jpg'],
  name: 'Galaxy Phone',
  slug: 'galaxy-phone',
} as unknown as NormalizedProductDetails;

describe('product-details-page lazy boundaries', () => {
  it('keeps negotiation modal behind a dynamic client boundary', () => {
    const pageSource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page.tsx',
      'utf8'
    );
    const lazySource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page/product-details-lazy-negotiation-modal.ts',
      'utf8'
    );

    expect(pageSource).not.toMatch(/import\s*{\s*NegotiationModal\s*}\s*from/);
    expect(lazySource).toMatch(/import\([^)]*NegotiationModal[^)]*\)/);
  });

  it('keeps post-action modal and cart animation code out of the initial client graph', () => {
    const pageSource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page.tsx',
      'utf8'
    );
    const flyToCartSource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page/product-details-lazy-fly-to-cart-animation.ts',
      'utf8'
    );
    const selectionModalSource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page/product-details-lazy-selection-required-modal.ts',
      'utf8'
    );

    expect(pageSource).not.toMatch(/import\s*{\s*FlyToCartAnimation\s*}\s*from/);
    expect(pageSource).not.toMatch(/import\s*{\s*SelectionRequiredModal\s*}\s*from/);
    expect(flyToCartSource).toMatch(/import\([^)]*FlyToCartAnimation[^)]*\)/);
    expect(selectionModalSource).toMatch(/import\([^)]*selection-required-modal[^)]*\)/);
  });

  it('does not mount the selection modal in the overlay runtime when closed', () => {
    render(
      <ProductDetailsPageOverlays
        animatingParticles={[]}
        currentOfferRawPrice={150000}
        effectiveAxes={['storage']}
        formatAxisLabel={(axis) => axis}
        getAxisOptions={() => ['128GB']}
        isNegotiationOpen={false}
        isSelectionModalOpen={false}
        merchantId="merchant-1"
        merchantVatRate={0.075}
        missingFields={[]}
        onAnimationComplete={vi.fn()}
        onCloseNegotiation={vi.fn()}
        onCloseSelectionModal={vi.fn()}
        onConfirmSelection={vi.fn()}
        onNegotiationSuccess={vi.fn()}
        onSelectAttribute={vi.fn()}
        onSelectColor={vi.fn()}
        productData={overlayProductData}
        selectedAttributes={{}}
        selectedColor={null}
        selectedCondition="new"
        selectedImage={0}
        variantSelectionAttributes={{}}
      />
    );

    expect(
      screen.queryByTestId('selection-required-modal')
    ).not.toBeInTheDocument();
  });

  it('mounts the selection modal in the overlay runtime when open', () => {
    render(
      <ProductDetailsPageOverlays
        animatingParticles={[]}
        currentOfferRawPrice={150000}
        effectiveAxes={['storage']}
        formatAxisLabel={(axis) => axis}
        getAxisOptions={() => ['128GB']}
        isNegotiationOpen={false}
        isSelectionModalOpen
        merchantId="merchant-1"
        merchantVatRate={0.075}
        missingFields={['Storage']}
        onAnimationComplete={vi.fn()}
        onCloseNegotiation={vi.fn()}
        onCloseSelectionModal={vi.fn()}
        onConfirmSelection={vi.fn()}
        onNegotiationSuccess={vi.fn()}
        onSelectAttribute={vi.fn()}
        onSelectColor={vi.fn()}
        productData={overlayProductData}
        selectedAttributes={{}}
        selectedColor={null}
        selectedCondition="new"
        selectedImage={0}
        variantSelectionAttributes={{}}
      />
    );

    expect(screen.getByTestId('selection-required-modal')).toBeInTheDocument();
  });
});
