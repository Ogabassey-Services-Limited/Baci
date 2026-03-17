import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Next.js shims
// ---------------------------------------------------------------------------
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: test shim for next/image
    <img {...props} alt={(props.alt as string) ?? ''} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Resolve dynamic() imports synchronously in tests
vi.mock('next/dynamic', () => ({
  default: (_loader: () => Promise<unknown>) => {
    // Return a stub — dynamic sections (ReviewsSection, RecentlyViewed) are
    // not the focus of these tests and can safely render nothing.
    return function DynamicStub() {
      return null;
    };
  },
}));

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------
vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    cart: [],
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    setMerchantSlug: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: vi.fn(() => ({
    formatCurrency: (amount: number) => `₦${amount.toLocaleString()}`,
    currencyCode: 'NGN',
  })),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test-store', country: 'NG' },
    basePath: '/test-store',
  })),
}));

vi.mock('@/hooks/use-recently-viewed', () => ({
  useRecentlyViewed: vi.fn(() => ({
    addToRecentlyViewed: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// Lib mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/event-tracking', () => ({
  trackEvent: {
    productView: vi.fn(),
    addToCart: vi.fn(),
  },
}));

vi.mock('@/lib/renderable-product-description', () => ({
  getRenderableProductDescription: vi.fn(() => ({ html: '<p>desc</p>' })),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

vi.mock('@/lib/currency-utils', () => ({
  getLocaleForCountry: vi.fn(() => 'en-NG'),
}));

// ---------------------------------------------------------------------------
// Component mocks
// ---------------------------------------------------------------------------
vi.mock('@/components/storefront/breadcrumbs', () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs" />,
}));

vi.mock('@/components/storefront/sticky-add-to-cart', () => ({
  StickyAddToCart: () => <div data-testid="sticky-add-to-cart" />,
}));

vi.mock('@/components/themed', () => ({
  ThemedBadge: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <span data-testid="themed-badge" {...rest}>
      {children}
    </span>
  ),
  ThemedButton: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <button type="button" {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div role="alert" {...rest}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
    // biome-ignore lint/a11y/noLabelWithoutControl: test mock
  }) => <label {...rest}>{children}</label>,
}));

vi.mock('@/components/ui/safe-html', () => ({
  SafeHtml: ({ html }: { html: string }) => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: test shim only
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => (
    <div data-testid="skeleton" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Subject under test (imported AFTER all vi.mock calls)
// ---------------------------------------------------------------------------
import type { Product } from '@/lib/products';
import ProductDetailClient from './product-detail-client';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    price: 25000,
    image: 'https://example.com/headphones.jpg',
    imageLarge: 'https://example.com/headphones-large.jpg',
    images: [
      {
        url: 'https://example.com/headphones.jpg',
        alt: 'Headphones',
        order: 0,
      },
    ],
    description: 'Great sound quality',
    status: 'active',
    stock: 10,
    manage_stock: true,
    has_variants: false,
    variants: [],
    category: 'Electronics',
    categories: null,
    merchant_id: 'm-1',
    condition: 'new',
    compare_at_price: undefined,
    minimum_order_quantity: undefined,
    imageHint: 'headphones product',
    sku: 'WH-001',
    mpn: 'WH-MPN-001',
    fulfillmentFields: [],
    product_key_specs: {},
    specifications: [],
    category_id: 'cat-1',
    category_slug: 'electronics',
    brand: 'SoundMax',
    condition_detail: undefined,
    low_stock_threshold: 5,
    gtin: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProductDetailClient', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('returns null for archived products', () => {
    const { container } = render(
      <ProductDetailClient product={buildProduct({ status: 'archived' })} />
    );

    // Nothing should be rendered
    expect(container.firstChild).toBeNull();
  });

  it('renders the product name', () => {
    render(<ProductDetailClient product={buildProduct()} />);

    expect(
      screen.getByRole('heading', { name: 'Wireless Headphones' })
    ).toBeInTheDocument();
  });

  it('renders the formatted product price', () => {
    render(<ProductDetailClient product={buildProduct({ price: 25000 })} />);

    // useCurrency mock formats as ₦25,000
    expect(screen.getByText('₦25,000')).toBeInTheDocument();
  });

  it('shows "In Stock" badge when stock is available', () => {
    render(
      <ProductDetailClient
        product={buildProduct({ stock: 10, manage_stock: true })}
      />
    );

    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('shows "Out of Stock" badge when stock is 0 and manage_stock is true', () => {
    render(
      <ProductDetailClient
        product={buildProduct({ stock: 0, manage_stock: true })}
      />
    );

    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('does not show "Out of Stock" badge when manage_stock is false even if stock is 0', () => {
    render(
      <ProductDetailClient
        product={buildProduct({ stock: 0, manage_stock: false })}
      />
    );

    expect(screen.queryByText('Out of Stock')).not.toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('renders the "Add to Cart" button', () => {
    render(<ProductDetailClient product={buildProduct()} />);

    expect(
      screen.getByRole('button', { name: 'Add to Cart' })
    ).toBeInTheDocument();
  });

  it('renders variant attribute buttons when product has variants', () => {
    const variantProduct = buildProduct({
      has_variants: true,
      variants: [
        {
          id: 'v-1',
          product_id: 'prod-1',
          merchant_id: 'm-1',
          attributes: { Color: 'Black' },
          stock_quantity: 5,
        },
        {
          id: 'v-2',
          product_id: 'prod-1',
          merchant_id: 'm-1',
          attributes: { Color: 'White' },
          stock_quantity: 3,
        },
      ],
    });

    render(<ProductDetailClient product={variantProduct} />);

    // Both variant values should appear as buttons
    expect(screen.getByRole('button', { name: /Black/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /White/ })).toBeInTheDocument();
  });

  it('pre-selects variant from ?variant= URL param', () => {
    // Set window.location.search before rendering
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?variant=v-2',
        href: 'https://ogabassey.com/phones/headphones?variant=v-2',
      },
    });

    const variantProduct = buildProduct({
      has_variants: true,
      variants: [
        {
          id: 'v-1',
          product_id: 'prod-1',
          merchant_id: 'm-1',
          attributes: { Color: 'Black' },
          stock_quantity: 5,
        },
        {
          id: 'v-2',
          product_id: 'prod-1',
          merchant_id: 'm-1',
          attributes: { Color: 'White' },
          stock_quantity: 3,
          primary_image: 'https://example.com/white.jpg',
        },
      ],
    });

    render(<ProductDetailClient product={variantProduct} />);

    // The attribute label shows "Color: <selected value>"
    // When v-2 is pre-selected, label text content should contain "White"
    const labels = screen.getAllByText(/White/);
    // At least 2: the label span AND the variant button
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to first variant when ?variant= does not match', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?variant=nonexistent',
        href: 'https://ogabassey.com/phones/headphones?variant=nonexistent',
      },
    });

    const variantProduct = buildProduct({
      has_variants: true,
      variants: [
        {
          id: 'v-1',
          product_id: 'prod-1',
          merchant_id: 'm-1',
          attributes: { Color: 'Black' },
          stock_quantity: 5,
        },
        {
          id: 'v-2',
          product_id: 'prod-1',
          merchant_id: 'm-1',
          attributes: { Color: 'White' },
          stock_quantity: 3,
        },
      ],
    });

    render(<ProductDetailClient product={variantProduct} />);

    // Falls back to first variant (Black) — should appear in both button AND label
    const blackElements = screen.getAllByText(/Black/);
    expect(blackElements.length).toBeGreaterThanOrEqual(2);
  });
});
