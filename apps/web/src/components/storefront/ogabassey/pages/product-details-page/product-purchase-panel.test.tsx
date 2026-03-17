import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before the component import
// ---------------------------------------------------------------------------

vi.mock('./product-details-helpers', () => ({
  buildDescriptionExcerpt: vi.fn(() => 'Mocked excerpt'),
}));

vi.mock('./product-summary-panel', () => ({
  ProductSummaryPanel: () => <div data-testid="product-summary-panel" />,
}));

vi.mock('./product-option-selectors', () => ({
  ProductOptionSelectors: (props: { descriptionExcerpt: string }) => (
    <div
      data-testid="product-option-selectors"
      data-description-excerpt={props.descriptionExcerpt}
    />
  ),
}));

vi.mock('./product-cart-actions', () => ({
  ProductCartActions: (props: { cartHref: string; quantityInCart: number }) => (
    <div
      data-testid="product-cart-actions"
      data-cart-href={props.cartHref}
      data-quantity-in-cart={props.quantityInCart}
    />
  ),
}));

// Import after mocks are registered
import { buildDescriptionExcerpt } from './product-details-helpers';
import type { NormalizedProductDetails } from './product-normalization';
import { ProductPurchasePanel } from './product-purchase-panel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProductData(
  overrides: Partial<NormalizedProductDetails> = {}
): NormalizedProductDetails {
  return {
    id: 'prod-1',
    name: 'Test Product',
    slug: 'test-product',
    price: '₦10,000',
    rawPrice: 10000,
    image: 'https://example.com/img.jpg',
    images: ['https://example.com/img.jpg'],
    description: '<p>A solid product.</p>',
    brand: 'TestBrand',
    condition: 'new',
    rating: 4,
    reviewCount: 12,
    specs: [{ label: 'Color', value: 'Black' }],
    detailedSpecs: [
      {
        category: 'General',
        items: [{ label: 'Brand', value: 'TestBrand' }],
      },
    ],
    colors: [],
    colorImages: {},
    storage: ['128GB'],
    platforms: [],
    ...overrides,
  };
}

function buildDefaultProps(overrides: Record<string, unknown> = {}) {
  return {
    cartHref: '/cart' as const,
    currentOfferPrice: '₦10,000',
    deliveryEstimate: '3–5 business days',
    deliveryLocation: 'Lagos' as const,
    descriptionHtml: '<p>A solid product.</p>',
    effectiveAxes: [],
    formatAxisLabel: vi.fn((axis: string) => axis),
    getAxisOptions: vi.fn((_axis: string) => []),
    inputValue: '1',
    isLiked: false,
    onAddToCart: vi.fn(),
    onChangeAttribute: vi.fn(),
    onChangeDeliveryLocation: vi.fn(),
    onDecrement: vi.fn(),
    onIncrement: vi.fn(),
    onInputBlur: vi.fn(),
    onInputChange: vi.fn(),
    onInputKeyDown: vi.fn(),
    onSelectColor: vi.fn(),
    onSelectSecondaryColor: vi.fn(),
    onSetCondition: vi.fn(),
    onShare: vi.fn(),
    onToggleSaved: vi.fn(),
    productData: buildProductData(),
    quantityInCart: 0,
    secondaryColor: null,
    selectedAttributes: {},
    selectedColor: null,
    selectedCondition: 'new' as const,
    showColorToast: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('ProductPurchasePanel — child component rendering', () => {
  it('renders ProductSummaryPanel', () => {
    render(<ProductPurchasePanel {...buildDefaultProps()} />);

    expect(screen.getByTestId('product-summary-panel')).toBeInTheDocument();
  });

  it('renders ProductOptionSelectors', () => {
    render(<ProductPurchasePanel {...buildDefaultProps()} />);

    expect(screen.getByTestId('product-option-selectors')).toBeInTheDocument();
  });

  it('renders ProductCartActions', () => {
    render(<ProductPurchasePanel {...buildDefaultProps()} />);

    expect(screen.getByTestId('product-cart-actions')).toBeInTheDocument();
  });

  it('renders all three child components at the same time', () => {
    render(<ProductPurchasePanel {...buildDefaultProps()} />);

    expect(screen.getByTestId('product-summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('product-option-selectors')).toBeInTheDocument();
    expect(screen.getByTestId('product-cart-actions')).toBeInTheDocument();
  });
});

describe('ProductPurchasePanel — buildDescriptionExcerpt integration', () => {
  it('calls buildDescriptionExcerpt with productData.description', () => {
    const productData = buildProductData({
      description: '<p>Detailed product description.</p>',
    });

    render(<ProductPurchasePanel {...buildDefaultProps({ productData })} />);

    expect(buildDescriptionExcerpt).toHaveBeenCalledWith(
      '<p>Detailed product description.</p>'
    );
  });

  it('passes the buildDescriptionExcerpt result to ProductOptionSelectors', () => {
    vi.mocked(buildDescriptionExcerpt).mockReturnValueOnce('Custom excerpt text');

    render(<ProductPurchasePanel {...buildDefaultProps()} />);

    expect(
      screen.getByTestId('product-option-selectors')
    ).toHaveAttribute('data-description-excerpt', 'Custom excerpt text');
  });
});

describe('ProductPurchasePanel — prop forwarding to ProductCartActions', () => {
  it('passes cartHref to ProductCartActions', () => {
    render(<ProductPurchasePanel {...buildDefaultProps({ cartHref: '/my-cart' as const })} />);

    expect(screen.getByTestId('product-cart-actions')).toHaveAttribute(
      'data-cart-href',
      '/my-cart'
    );
  });

  it('passes quantityInCart to ProductCartActions', () => {
    render(<ProductPurchasePanel {...buildDefaultProps({ quantityInCart: 3 })} />);

    expect(screen.getByTestId('product-cart-actions')).toHaveAttribute(
      'data-quantity-in-cart',
      '3'
    );
  });

  it('passes quantityInCart of zero to ProductCartActions', () => {
    render(<ProductPurchasePanel {...buildDefaultProps({ quantityInCart: 0 })} />);

    expect(screen.getByTestId('product-cart-actions')).toHaveAttribute(
      'data-quantity-in-cart',
      '0'
    );
  });
});
