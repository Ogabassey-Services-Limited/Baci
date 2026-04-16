import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedProductDetails } from './product-details-helpers';
import type { ProductDetailsActiveTab } from './use-product-details-state';

// SafeHtml relies on sanitizeHtml; pass-through so we can assert rendered text
const mockSanitizeHtml = vi.fn((s: string, _options?: unknown) => s);

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (html: string, options?: unknown) =>
    mockSanitizeHtml(html, options),
}));

// ProductComparisonTable has its own hooks/network calls — stub it out
vi.mock('../../components/ProductComparisonTable', () => ({
  ProductComparisonTable: () => (
    <table role="table" aria-label="Comparison Table">
      <tbody>
        <tr>
          <td>Comparison Table</td>
        </tr>
      </tbody>
    </table>
  ),
}));

// Import after mocks are registered
import { ProductDetailsTabs } from './product-details-tabs';

beforeEach(() => {
  mockSanitizeHtml.mockClear();
});

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
    description: '<p>This is the product description.</p>',
    brand: 'TestBrand',
    condition: 'new',
    rating: 4,
    reviewCount: 12,
    specs: [
      { label: 'Color', value: 'Black' },
      { label: 'Weight', value: '200g' },
    ],
    detailedSpecs: [
      {
        category: 'General',
        items: [
          { label: 'Brand', value: 'TestBrand' },
          { label: 'Condition', value: 'New' },
        ],
      },
    ],
    colors: [],
    colorImages: {},
    storage: ['128GB'],
    platforms: [],
    displaySize: '6.1 inches',
    ram: '8GB',
    ...overrides,
  };
}

function renderTabs(
  activeTab: ProductDetailsActiveTab = 'description',
  overrides: Partial<NormalizedProductDetails> = {}
) {
  const onSelectTab = vi.fn();
  const productData = buildProductData(overrides);

  render(
    <ProductDetailsTabs
      activeTab={activeTab}
      normalizedReviewRatingWidth="80%"
      onSelectTab={onSelectTab}
      productData={productData}
      storeSlug="test-store"
    />
  );

  return { onSelectTab, productData };
}

// ---------------------------------------------------------------------------
// Tab list rendering
// ---------------------------------------------------------------------------

describe('ProductDetailsTabs — tab list', () => {
  it('renders all four tab buttons', () => {
    renderTabs();

    expect(screen.getByRole('tab', { name: 'Description' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Specifications' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Reviews (12)' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /compare/i })
    ).toBeInTheDocument();
  });

  it('reflects the review count from productData in the reviews tab label', () => {
    renderTabs('description', { reviewCount: 42 });

    expect(screen.getByRole('tab', { name: 'Reviews (42)' })).toBeInTheDocument();
  });

  it('marks the active tab as aria-selected=true and others as false', () => {
    renderTabs('specs');

    expect(
      screen.getByRole('tab', { name: 'Specifications' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', { name: 'Description' })
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelectTab with the correct value when a tab is clicked', () => {
    const { onSelectTab } = renderTabs('description');

    fireEvent.click(screen.getByRole('tab', { name: 'Specifications' }));

    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenCalledWith('specs');
  });

  it('calls onSelectTab with "reviews" when the reviews tab is clicked', () => {
    const { onSelectTab } = renderTabs('description');

    fireEvent.click(screen.getByRole('tab', { name: 'Reviews (12)' }));

    expect(onSelectTab).toHaveBeenCalledWith('reviews');
  });
});

// ---------------------------------------------------------------------------
// Description tab panel
// ---------------------------------------------------------------------------

describe('ProductDetailsTabs — description tab panel', () => {
  it('renders the description tabpanel when activeTab is "description"', () => {
    renderTabs('description');

    expect(
      screen.getByRole('tabpanel', { name: 'Description' })
    ).toBeInTheDocument();
  });

  it('renders the HTML description content via SafeHtml', () => {
    renderTabs('description', {
      description: '<p>Great product with long battery life.</p>',
    });

    expect(
      screen.getByText('Great product with long battery life.')
    ).toBeInTheDocument();
  });

  it('demotes imported description headings to avoid multiple page h1 tags', () => {
    renderTabs('description', {
      description: '<h1>Imported Title</h1><p>Body copy</p>',
    });

    expect(mockSanitizeHtml).toHaveBeenCalledWith(
      '<h1>Imported Title</h1><p>Body copy</p>',
      { headingLevelOffset: 1 }
    );
  });

  it('renders Key Highlights section with specs when specs are provided', () => {
    renderTabs('description');

    expect(
      screen.getByRole('heading', { name: 'Key Highlights' })
    ).toBeInTheDocument();
    // Spec labels and values from buildProductData
    expect(screen.getByText('Color:')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
  });

  it('renders product field fallbacks in Key Highlights when specs array is empty', () => {
    renderTabs('description', {
      specs: [],
      displaySize: '6.7 inches',
      ram: '12GB',
      storage: ['256GB'],
      condition: 'open_box',
      brand: 'Samsung',
    });

    expect(screen.getByText('6.7 inches Display')).toBeInTheDocument();
    expect(screen.getByText('12GB RAM')).toBeInTheDocument();
    expect(screen.getByText('256GB Storage')).toBeInTheDocument();
    expect(screen.getByText('Condition: Open Box')).toBeInTheDocument();
    expect(screen.getByText('Samsung Official Warranty')).toBeInTheDocument();
  });

  it('does not render the description tabpanel when a different tab is active', () => {
    renderTabs('specs');

    expect(
      screen.queryByRole('tabpanel', { name: 'Description' })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Specifications tab panel
// ---------------------------------------------------------------------------

describe('ProductDetailsTabs — specs tab panel', () => {
  it('renders the specs tabpanel when activeTab is "specs"', () => {
    renderTabs('specs');

    expect(
      screen.getByRole('tabpanel', { name: 'Specifications' })
    ).toBeInTheDocument();
  });

  it('renders detailed spec categories and their items', () => {
    renderTabs('specs', {
      detailedSpecs: [
        {
          category: 'Display',
          items: [{ label: 'Resolution', value: '2532 x 1170' }],
        },
      ],
    });

    expect(
      screen.getByRole('heading', { name: 'Display', level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText('Resolution')).toBeInTheDocument();
    expect(screen.getByText('2532 x 1170')).toBeInTheDocument();
  });

  it('does not render the specs tabpanel when description tab is active', () => {
    renderTabs('description');

    expect(
      screen.queryByRole('tabpanel', { name: 'Specifications' })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Reviews tab panel
// ---------------------------------------------------------------------------

describe('ProductDetailsTabs — reviews tab panel', () => {
  it('renders the reviews tabpanel when activeTab is "reviews"', () => {
    renderTabs('reviews');

    expect(
      screen.getByRole('tabpanel', { name: /reviews/i })
    ).toBeInTheDocument();
  });

  it('displays the review count in the summary area', () => {
    renderTabs('reviews', { reviewCount: 5, rating: 4 });

    expect(screen.getByText('Based on 5 reviews')).toBeInTheDocument();
  });

  it('renders the rating clamped to 5 when rating exceeds 5', () => {
    renderTabs('reviews', { rating: 99, reviewCount: 3 });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders the rating clamped to 0 when rating is negative', () => {
    renderTabs('reviews', { rating: -2, reviewCount: 1 });

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders an empty-state message when reviewCount is 0', () => {
    renderTabs('reviews', { reviewCount: 0 });

    expect(
      screen.getByText('No reviews yet. Be the first to review this product!')
    ).toBeInTheDocument();
  });

  it('renders the review system placeholder when reviewCount is greater than 0', () => {
    renderTabs('reviews', { reviewCount: 8 });

    expect(
      screen.getByText(/Reviews are loaded from the store/i)
    ).toBeInTheDocument();
  });

  it('renders the "Write a Review" button as disabled', () => {
    renderTabs('reviews');

    const button = screen.getByRole('button', { name: 'Write a Review' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});

// ---------------------------------------------------------------------------
// Compare tab panel
// ---------------------------------------------------------------------------

describe('ProductDetailsTabs — compare tab panel', () => {
  it('renders the compare tabpanel when activeTab is "compare"', () => {
    renderTabs('compare');

    expect(
      screen.getByRole('tabpanel', { name: /compare/i })
    ).toBeInTheDocument();
  });

  it('renders the ProductComparisonTable stub inside the compare panel', () => {
    renderTabs('compare');

    expect(screen.getByRole('table', { name: /comparison table/i })).toBeInTheDocument();
  });

  it('does not render the compare panel when description tab is active', () => {
    renderTabs('description');

    expect(screen.queryByRole('table', { name: /comparison table/i })).not.toBeInTheDocument();
  });
});
