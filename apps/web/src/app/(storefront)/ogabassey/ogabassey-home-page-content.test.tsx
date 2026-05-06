import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontHomeProducts } from '@/lib/cached-data';

const { mockHeaders, mockPublishedMerchant } = vi.hoisted(() => ({
  mockHeaders: vi.fn(() => Promise.resolve(new Headers())),
  mockPublishedMerchant: {
    id: 'merchant-1',
    business_name: 'OgaBassey',
    business_type: 'electronics',
    email: 'hello@ogabassey.com',
    phone: '+2341234567',
    logo_url: '',
    brand_colors: undefined,
    country: 'NG',
    pages: undefined,
    slug: 'ogabassey',
    custom_domain: 'ogabassey.com',
    favicon_svg_url: undefined,
    favicon_png_32_url: undefined,
    favicon_apple_touch_url: undefined,
    social_media: undefined,
    business_address: '',
    is_published: true,
    feature_settings: undefined,
    template_id: 'ogabassey',
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
  },
}));

vi.mock('@/lib/cached-data', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCachedStorefrontHomeProducts: vi.fn(() => Promise.resolve([])),
    getRequestScopedMerchant: vi.fn(() =>
      Promise.resolve(mockPublishedMerchant)
    ),
  };
});

vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(() =>
    Promise.resolve([{ name: 'Smartphones', slug: 'smartphones' }])
  ),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/server', () => ({
  connection: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/components/analytics/analytics-provider', () => ({
  AnalyticsProvider: () => <div data-testid="analytics-provider" />,
}));

vi.mock('@/components/storefront/ogabassey/pages/home', () => ({
  OgabasseyHomePage: ({
    products,
    storeSlug,
  }: {
    products?: unknown[];
    storeSlug?: string;
  }) => (
    <div data-testid="ogabassey-home">
      {storeSlug}:{products?.length ?? 0}
    </div>
  ),
}));

vi.mock('@/components/storefront/ogabassey/home-product-feed', () => ({
  createOgabasseyHomeProductFeed: vi.fn((products: unknown[]) =>
    products.slice(0, 1)
  ),
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: ({ businessName }: { businessName: string }) => (
    <div data-testid="store-not-published">{businessName}</div>
  ),
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

import { notFound } from 'next/navigation';
import { createOgabasseyHomeProductFeed } from '@/components/storefront/ogabassey/home-product-feed';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';

type StorefrontHomeProduct = Awaited<
  ReturnType<typeof getCachedStorefrontHomeProducts>
>[number];

function createProduct(): StorefrontHomeProduct {
  return {
    id: 'product-1',
    name: 'iPhone 17 Pro Max',
    slug: 'iphone-17-pro-max',
    description: 'Apple flagship phone.',
    price: 2500000,
    compare_at_price: null,
    images: null,
    category: 'Smartphones',
    brand: 'Apple',
    condition: 'new',
    stock: 4,
    stock_quantity: null,
    manage_stock: false,
    low_stock_threshold: null,
    product_categories: [],
  };
}

describe('OgabasseyHomePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it('renders the OgaBassey homepage without the generic storefront renderer', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createProduct(),
    ]);

    const result = await OgabasseyHomePageContent();

    render(result as React.ReactElement);

    expect(screen.getByTestId('analytics-provider')).toBeInTheDocument();
    expect(screen.getByTestId('ogabassey-home')).toHaveTextContent(
      'ogabassey:1'
    );
    expect(createOgabasseyHomeProductFeed).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'product-1' })])
    );
    expect(screen.getByRole('link', { name: 'Smartphones' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('resolves the homepage merchant from custom-domain request context', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    const result = await OgabasseyHomePageContent();

    render(result as React.ReactElement);

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey.com');
    expect(screen.getByRole('link', { name: 'All Products' })).toHaveAttribute(
      'href',
      '/products'
    );
  });

  it('falls back to the OgaBassey slug when only a deployment host is present', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['host', 'baci-preview.vercel.app']])
    );

    await OgabasseyHomePageContent();

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('shows the unpublished storefront state when production store is disabled', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce({
      ...mockPublishedMerchant,
      is_published: false,
    });

    const result = await OgabasseyHomePageContent();

    render(result as React.ReactElement);

    expect(screen.getByTestId('store-not-published')).toHaveTextContent(
      'OgaBassey'
    );
  });

  it('returns 404 when merchant lookup is null', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce(null);

    await expect(OgabasseyHomePageContent()).rejects.toThrow('not-found');

    expect(notFound).toHaveBeenCalledOnce();
  });
});
