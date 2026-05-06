import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontHomeProducts } from '@/lib/cached-data';

// Mock server-only dependencies
vi.mock('@/lib/cached-data', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCachedStorefrontHomeProducts: vi.fn(() => Promise.resolve([])),
  };
});
vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
  getTemplateIdByBusinessType: vi.fn(() => null),
}));
vi.mock('./resolve-storefront-template', () => ({
  resolveStorefrontTemplateId: vi.fn(() => null),
}));
vi.mock('./storefront-wrapper', () => ({
  StorefrontWrapper: ({ products }: { products: unknown[] }) => (
    <div data-testid="storefront-wrapper">
      Products: {Array.isArray(products) ? products.length : 0}
    </div>
  ),
}));
vi.mock('@/components/analytics/analytics-provider', () => ({
  AnalyticsProvider: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/home', () => ({
  OgabasseyHomePage: ({
    products,
    storeSlug,
  }: {
    products?: unknown[];
    storeSlug?: string;
  }) => (
    <div data-testid="ogabassey-direct-home">
      {storeSlug}:{products?.length ?? 0}
    </div>
  ),
}));
vi.mock('@/components/storefront/ogabassey/home-product-feed', () => ({
  createOgabasseyHomeProductFeed: vi.fn((products: unknown[]) =>
    products.slice(0, 1)
  ),
}));
vi.mock('@/components/ui/skeletons', () => ({
  StorefrontPageSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

import type { CachedMerchant } from '@/lib/cached-data';
import {
  StorefrontContent,
  StreamingStorefrontContent,
} from './storefront-content';

function createMockMerchant(): CachedMerchant {
  return {
    id: 'merchant-1',
    business_name: 'Test Store',
    business_type: 'general',
    email: 'test@example.com',
    phone: '+2341234567',
    logo_url: '',
    brand_colors: undefined,
    country: 'NG',
    pages: undefined,
    slug: 'test-store',
    custom_domain: undefined,
    favicon_svg_url: undefined,
    favicon_png_32_url: undefined,
    favicon_apple_touch_url: undefined,
    social_media: undefined,
    business_address: '',
    is_published: true,
    feature_settings: undefined,
    template_id: '',
    vat_registration_status: undefined,
    vat_rate: undefined,
    hero_slides: undefined,
    mobile_hero_slides: undefined,
    site_title: '',
    site_tagline: '',
    site_description: '',
    payout_currency: 'NGN',
    plan_tier: 'free',
    premium_features: undefined,
  };
}

type StorefrontHomeProduct = Awaited<
  ReturnType<typeof getCachedStorefrontHomeProducts>
>[number];

function createMockHomeProduct(
  overrides: Partial<StorefrontHomeProduct> = {}
): StorefrontHomeProduct {
  return {
    id: 'product-1',
    name: 'Galaxy Fold',
    slug: 'galaxy-fold',
    description: 'Premium foldable phone.',
    price: 1200000,
    compare_at_price: null,
    images: null,
    category: 'Smartphones',
    brand: null,
    condition: null,
    stock: 3,
    stock_quantity: null,
    manage_stock: false,
    low_stock_threshold: null,
    product_categories: [],
    ...overrides,
  };
}

function createMockProductCategories(): StorefrontHomeProduct['product_categories'] {
  return [
    {
      categories: [
        {
          name: 'Smartphones',
          slug: 'smartphones',
        },
      ],
    },
  ];
}

const mockMerchant = createMockMerchant();

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('StorefrontContent', () => {
  beforeEach(() => {
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it('renders the fallback StorefrontWrapper when no template matches', async () => {
    const result = await StorefrontContent({ merchant: mockMerchant });

    render(result as React.ReactElement);
    expect(screen.getByText(/Products: \d+/)).toBeInTheDocument();
  });

  it('renders template Home component when template is resolved', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );
    const { getTemplate } = await import('@/templates/registry');

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('electronics');
    vi.mocked(getTemplate).mockReturnValue({
      getComponents: () =>
        Promise.resolve({
          Home: (props: Record<string, unknown>) => (
            <div data-testid="template-home">{String(props.storeSlug)}</div>
          ),
        }),
    } as unknown as ReturnType<typeof getTemplate>);

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    expect(screen.getByTestId('template-home')).toBeInTheDocument();
    expect(screen.getByText('test-store')).toBeInTheDocument();
  });

  it('renders OgaBassey home without loading the generic template registry', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );
    const { getTemplate } = await import('@/templates/registry');
    const { createOgabasseyHomeProductFeed } = await import(
      '@/components/storefront/ogabassey/home-product-feed'
    );

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('ogabassey');
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createMockHomeProduct({
        id: 'ogabassey-product-1',
        name: 'OgaBassey Product 1',
        slug: 'ogabassey-product-1',
      }),
    ]);

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    expect(getTemplate).not.toHaveBeenCalled();
    expect(createOgabasseyHomeProductFeed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ogabassey-product-1' }),
      ])
    );
    expect(screen.getByTestId('ogabassey-direct-home')).toHaveTextContent(
      'test-store:1'
    );
  });

  it('falls back to StorefrontWrapper when template render throws', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );
    const { getTemplate } = await import('@/templates/registry');

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('electronics');
    vi.mocked(getTemplate).mockReturnValue({
      getComponents: () => Promise.reject(new Error('render failure')),
    } as unknown as ReturnType<typeof getTemplate>);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(
      // intentionally suppress console.error during test
      () => undefined
    );

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    expect(screen.getByText(/Products: \d+/)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('emits collection schema for homepage featured products', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createMockHomeProduct({
        id: 'product-1',
        name: 'Galaxy Fold',
        description: '<p>Premium foldable phone.</p>',
        price: 1200000,
        manage_stock: false,
        stock: 3,
        category: 'Smartphones',
        slug: 'galaxy-fold',
      }),
    ]);

    const result = await StorefrontContent({ merchant: mockMerchant });

    render(result as React.ReactElement);

    const schemaScript = document.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(schemaScript).not.toBeNull();

    const schema = JSON.parse(schemaScript?.textContent || '{}') as {
      '@type': string;
      mainEntity?: { '@type': string };
    };

    expect(schema['@type']).toBe('CollectionPage');
    expect(schema.mainEntity?.['@type']).toBe('ItemList');
  });

  it('caps OgaBassey homepage collection schema to first-render products', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('ogabassey');
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue(
      Array.from({ length: 12 }, (_, index) =>
        createMockHomeProduct({
          id: `product-${index + 1}`,
          name: `Product ${index + 1}`,
          description: `Description ${index + 1}`,
          price: 100000 + index,
          manage_stock: false,
          stock: 3,
          category: 'Smartphones',
          slug: `product-${index + 1}`,
        })
      )
    );

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    const schemaScript = document.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(schemaScript).not.toBeNull();
    const schema = JSON.parse(schemaScript?.textContent || '{}') as {
      mainEntity?: {
        itemListElement?: Array<{
          item?: { name?: string };
        }>;
      };
    };

    expect(schema).toBeDefined();
    expect(schema.mainEntity).toBeDefined();
    expect(schema.mainEntity?.itemListElement).toHaveLength(8);
    expect(
      schema.mainEntity?.itemListElement?.map((entry) => entry.item?.name)
    ).toEqual([
      'Product 1',
      'Product 2',
      'Product 3',
      'Product 4',
      'Product 5',
      'Product 6',
      'Product 7',
      'Product 8',
    ]);
  });

  it('preserves full product fields for non-OgaBassey templates', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );
    const { getTemplate } = await import('@/templates/registry');
    const templateHome = vi.fn(() => (
      <div data-testid="template-home">Home</div>
    ));

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('electronics');
    vi.mocked(getTemplate).mockReturnValue({
      getComponents: () =>
        Promise.resolve({
          Home: templateHome,
        }),
    } as unknown as ReturnType<typeof getTemplate>);
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createMockHomeProduct({
        id: 'full-product',
        name: 'Full Product',
        description: 'Full description',
        price: 1200000,
        manage_stock: false,
        stock: 3,
        category: 'Smartphones',
        slug: 'full-product',
        product_categories: createMockProductCategories(),
      }),
    ]);

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    expect(templateHome).toHaveBeenCalledWith(
      expect.objectContaining({
        products: [
          expect.objectContaining({
            id: 'full-product',
            description: 'Full description',
            price: 1200000,
            categories: [
              expect.objectContaining({
                slug: 'smartphones',
              }),
            ],
          }),
        ],
      }),
      undefined
    );
  });

  it('hides the homepage Blog discovery link when blog feature is disabled', async () => {
    const merchantWithoutBlog: CachedMerchant = {
      ...mockMerchant,
      feature_settings: { blog_enabled: false },
    };

    const result = await StorefrontContent({ merchant: merchantWithoutBlog });
    render(result as React.ReactElement);

    expect(screen.queryByRole('link', { name: 'Blog' })).toBeNull();
  });

  it('renders the homepage Blog discovery link when blog feature is enabled', async () => {
    const merchantWithBlog: CachedMerchant = {
      ...mockMerchant,
      feature_settings: { blog_enabled: true },
    };

    const result = await StorefrontContent({ merchant: merchantWithBlog });
    render(result as React.ReactElement);

    expect(screen.getByRole('link', { name: 'Blog' })).toBeInTheDocument();
  });
});

describe('StreamingStorefrontContent', () => {
  it('renders a Suspense fallback skeleton', () => {
    render(<StreamingStorefrontContent merchant={mockMerchant} />);

    // The Suspense boundary should show the skeleton while the async content loads
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
