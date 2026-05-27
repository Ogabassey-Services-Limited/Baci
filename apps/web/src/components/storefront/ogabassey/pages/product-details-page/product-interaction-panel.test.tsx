import { render, screen } from '@testing-library/react';
import type { Route } from 'next';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedProductDetails } from './product-details-helpers';
import { ProductInteractionPanel } from './product-interaction-panel';

const { mockProductSummaryPanel } = vi.hoisted(() => ({
  mockProductSummaryPanel: vi.fn(),
}));

vi.mock('./product-summary-panel', () => ({
  ProductSummaryPanel: (props: Record<string, unknown>) => {
    mockProductSummaryPanel(props);
    return (
      <div data-testid="summary-controls">
        <button type="button">Share this product</button>
        <button type="button">Add to wishlist</button>
      </div>
    );
  },
}));

vi.mock('./product-option-selectors', () => ({
  ProductOptionSelectors: () => (
    <section aria-label="Product option selectors" />
  ),
}));

vi.mock('./product-cart-actions', () => ({
  ProductCartActions: () => <button type="button">Add to Cart</button>,
}));

const productData = {
  brand: 'Lenovo',
  category: 'Laptops',
  colors: [],
  condition: 'used',
  description: '<p>Gaming laptop</p>',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  images: ['https://cdn.ogabassey.com/core-assets/products/legion.avif'],
  manage_stock: true,
  name: 'Lenovo Legion Pro 9',
  price: '₦5,985,000',
  rawPrice: 5_985_000,
  rating: 4.5,
  reviewCount: 12,
  slug: 'lenovo-legion-pro-9',
  stock: 3,
  variants: [],
} as unknown as NormalizedProductDetails;

function renderPanel() {
  return render(
    <ProductInteractionPanel
      availableConditions={['used']}
      canPurchase
      cartHref={'/cart' as Route}
      currentOfferPrice="₦5,985,000"
      deliveryEstimate="Tomorrow"
      deliveryLocation="Lagos"
      effectiveAxes={[]}
      formatAxisLabel={(axis) => axis}
      getAxisOptions={() => []}
      inputValue="1"
      isLiked={false}
      onAddToCart={vi.fn()}
      onChangeAttribute={vi.fn()}
      onChangeDeliveryLocation={vi.fn()}
      onDecrement={vi.fn()}
      onIncrement={vi.fn()}
      onInputBlur={vi.fn()}
      onInputChange={vi.fn()}
      onInputKeyDown={vi.fn()}
      onSelectColor={vi.fn()}
      onSelectSecondaryColor={vi.fn()}
      onSetCondition={vi.fn()}
      onShare={vi.fn()}
      onToggleSaved={vi.fn()}
      productData={productData}
      quantityInCart={0}
      secondaryColor={null}
      selectedAttributes={{}}
      selectedColor={null}
      selectedCondition="used"
      showColorToast={false}
    />
  );
}

describe('ProductInteractionPanel', () => {
  it('renders commerce controls without duplicating the server-owned product identity', () => {
    const { container } = renderPanel();

    expect(screen.getByTestId('summary-controls')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add to Cart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Product option selectors' })
    ).toBeInTheDocument();
    expect(mockProductSummaryPanel).toHaveBeenCalledWith(
      expect.objectContaining({ summaryOnly: true })
    );
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
