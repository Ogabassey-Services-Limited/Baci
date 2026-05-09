import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontHomeProducts } from '@/lib/cached-data';

const mockMerchant = {
  id: 'merchant-1',
  business_name: 'Oga & Bassey',
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
};

vi.mock('@/lib/cached-data', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCachedStorefrontHomeProducts: vi.fn(() => Promise.resolve([])),
  };
});

vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(() =>
    Promise.resolve([{ name: 'Smartphones', slug: 'smartphones' }])
  ),
}));

vi.mock('@/components/analytics/analytics-provider', () => ({
  AnalyticsProvider: () => <div data-testid="analytics-provider" />,
}));

vi.mock('@/components/storefront/ogabassey/pages/home', () => ({
  OgabasseyHomePage: ({
    products,
    renderHero,
    storeSlug,
  }: {
    products?: unknown[];
    renderHero?: boolean;
    storeSlug?: string;
  }) => (
    <div data-testid="ogabassey-home">
      {storeSlug}:{products?.length ?? 0}:{String(renderHero)}
    </div>
  ),
}));

vi.mock('@/components/storefront/ogabassey/home-product-feed', () => ({
  createOgabasseyHomeProductFeed: vi.fn((products: unknown[]) =>
    products.slice(0, 1)
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

import { createOgabasseyHomeProductFeed } from '@/components/storefront/ogabassey/home-product-feed';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';

type StorefrontHomeProduct = Awaited<
  ReturnType<typeof getCachedStorefrontHomeProducts>
>[number];

function createProduct(
  overrides: Partial<StorefrontHomeProduct> = {}
): StorefrontHomeProduct {
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
    ...overrides,
  };
}

describe('OgabasseyHomeDynamicContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([]);
  });

  it('renders home data without duplicating the hero shell', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createProduct(),
    ]);

    const result = await OgabasseyHomeDynamicContent({
      merchant: mockMerchant,
      pathPrefix: '/ogabassey',
    });

    render(result as ReactElement);

    expect(screen.getByTestId('analytics-provider')).toBeInTheDocument();
    expect(screen.getByTestId('ogabassey-home')).toHaveTextContent(
      'ogabassey:1:false'
    );
    expect(createOgabasseyHomeProductFeed).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'product-1' })])
    );
    expect(screen.getByRole('link', { name: 'Smartphones' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
  });

  it('emits raw parsable JSON-LD scripts', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createProduct(),
    ]);

    const result = await OgabasseyHomeDynamicContent({
      merchant: mockMerchant,
      pathPrefix: '/ogabassey',
    });

    const { container } = render(result as ReactElement);
    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    expect(scripts).toHaveLength(2);
    for (const script of scripts) {
      expect(script.innerHTML).not.toContain('&amp;');
      expect(() => JSON.parse(script.innerHTML || '')).not.toThrow();
    }
  });
});
