import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontHomeProducts } from '@/lib/cached-data';
import { getCachedStorefrontProductsBySlugs } from '@/lib/cached-storefront-products-by-slugs';

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
  feature_settings: {
    google_analytics_id: 'G-OGABASSEY',
  },
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

vi.mock('@/lib/cached-storefront-products-by-slugs', () => ({
  getCachedStorefrontProductsBySlugs: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(() =>
    Promise.resolve([{ name: 'Smartphones', slug: 'smartphones' }])
  ),
}));

vi.mock('@/components/analytics/analytics-pixel-provider', () => ({
  AnalyticsPixelProvider: ({
    merchant,
  }: {
    merchant?: Record<string, string | null | undefined> | null;
  }) => (
    <output aria-label="Merchant analytics">{JSON.stringify(merchant)}</output>
  ),
}));

vi.mock('@/components/storefront/ogabassey/pages/home', () => ({
  OgabasseyHomePage: ({
    basePath,
    products,
    storeSlug,
  }: {
    basePath?: string;
    products?: unknown[];
    storeSlug?: string;
  }) => (
    <section aria-label="OgaBassey home payload">
      {storeSlug}:{basePath}:{products?.length ?? 0}
    </section>
  ),
}));

vi.mock('@/components/storefront/ogabassey/home-product-feed', () => ({
  createOgabasseyHomeProductFeed: vi.fn((products: unknown[]) =>
    products.slice(0, 1)
  ),
  mapStorefrontProductsToOgabasseyProducts: vi.fn(
    (products: unknown[]) => products
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
    images: [
      'https://cdn.ogabassey.com/core-assets/products/iphone-17-pro-max.avif',
    ],
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
    vi.mocked(getCachedStorefrontProductsBySlugs).mockResolvedValue([]);
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

    expect(
      screen.getByRole('status', { name: 'Merchant analytics' })
    ).toHaveTextContent('G-OGABASSEY');
    expect(
      screen.getByRole('region', { name: 'OgaBassey home payload' })
    ).toHaveTextContent('ogabassey:/ogabassey:1');
    expect(createOgabasseyHomeProductFeed).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'product-1' })])
    );
    expect(screen.getByRole('link', { name: 'Smartphones' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
  });

  it('requests home products ordered by most recently updated', async () => {
    await OgabasseyHomeDynamicContent({
      merchant: mockMerchant,
      pathPrefix: '/ogabassey',
    });

    expect(getCachedStorefrontHomeProducts).toHaveBeenCalledWith(
      'merchant-1',
      'recent'
    );
  });

  it('falls back to normalized legacy analytics IDs when feature settings are blank', async () => {
    const merchantWithLegacyAnalytics = {
      ...mockMerchant,
      feature_settings: {
        ...mockMerchant.feature_settings,
        google_analytics_id: '   ',
      },
      google_analytics_id: ' G-LEGACY ',
      facebook_pixel_id: '   ',
    };

    const result = await OgabasseyHomeDynamicContent({
      merchant: merchantWithLegacyAnalytics,
      pathPrefix: '/ogabassey',
    });

    render(result as ReactElement);

    const analytics = screen.getByRole('status', {
      name: 'Merchant analytics',
    });

    expect(analytics).toHaveTextContent('"google_analytics_id":"G-LEGACY"');
    expect(analytics).toHaveTextContent('"facebook_pixel_id":null');
  });

  it('keeps discovery links for products whose slugs are generated from names', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createProduct({
        id: 'product-slugless',
        name: 'Galaxy Fold 8',
        slug: '',
      }),
    ]);

    const result = await OgabasseyHomeDynamicContent({
      merchant: mockMerchant,
      pathPrefix: '/ogabassey',
    });

    render(result as ReactElement);

    expect(screen.getByRole('link', { name: 'Galaxy Fold 8' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/galaxy-fold-8'
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

    expect(scripts).toHaveLength(1);
    for (const script of scripts) {
      expect(script.innerHTML).not.toContain('&amp;');
      expect(() => JSON.parse(script.innerHTML || '')).not.toThrow();
    }

    const schema = JSON.parse(scripts[0]?.innerHTML || '{}') as {
      '@graph': Record<string, unknown>[];
    };

    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@id': 'https://ogabassey.com/#online-store',
          '@type': 'OnlineStore',
        }),
        expect.objectContaining({
          '@id': 'https://ogabassey.com/#homepage',
          '@type': 'CollectionPage',
          mainEntity: expect.objectContaining({
            '@id': 'https://ogabassey.com/#featured-products',
            '@type': 'ItemList',
          }),
        }),
        expect.objectContaining({
          '@id': 'https://ogabassey.com/#category-hubs',
          '@type': 'ItemList',
        }),
        expect.objectContaining({
          '@id': 'https://ogabassey.com/#site-navigation',
          '@type': 'SiteNavigationElement',
        }),
      ])
    );
  });

  it('prepends targeted pinned launch products into the home ItemList even when they fall outside the recent window', async () => {
    // Recent window: 8 products, none of them the pinned launch device.
    const windowProducts = Array.from({ length: 8 }, (_, index) =>
      createProduct({
        id: `recent-${index}`,
        name: `Recent ${index}`,
        slug: `recent-${index}`,
      })
    );
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue(
      windowProducts
    );
    // The targeted by-slug fetch returns the pin that is absent from the window.
    // A real pinned product carries an image, so it survives the renderable
    // filter and is prepended into the launch set + schema.
    vi.mocked(getCachedStorefrontProductsBySlugs).mockResolvedValue([
      createProduct({
        id: 'a27',
        name: 'Samsung Galaxy A27 5G Preorder',
        slug: 'samsung-galaxy-a27-5g',
        category: 'Smartphones',
        images: ['https://cdn.ogabassey.com/products/a27.avif'],
      }),
    ]);

    const result = await OgabasseyHomeDynamicContent({
      merchant: mockMerchant,
      pathPrefix: '/ogabassey',
    });

    const { container } = render(result as ReactElement);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const json = script?.innerHTML || '{}';

    // The pin made it into the schema even though it was never in the recent
    // window — proof the deterministic pinned fetch is wired into the ItemList.
    expect(json).toContain('samsung-galaxy-a27-5g');

    const schema = JSON.parse(json) as { '@graph': Record<string, unknown>[] };
    const collectionPage = schema['@graph'].find(
      (node) => node['@type'] === 'CollectionPage'
    ) as { mainEntity?: { itemListElement?: unknown[] } } | undefined;
    const elements = collectionPage?.mainEntity?.itemListElement ?? [];
    // Pinned-first: the A27 leads the featured-products ItemList.
    expect(JSON.stringify(elements[0])).toContain('samsung-galaxy-a27-5g');
  });

  it('includes the blog hub in the semantic graph only when the visible blog link is enabled', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      createProduct(),
    ]);

    const result = await OgabasseyHomeDynamicContent({
      merchant: {
        ...mockMerchant,
        feature_settings: {
          ...mockMerchant.feature_settings,
          blog_enabled: true,
        },
      },
      pathPrefix: '',
    });

    const { container } = render(result as ReactElement);
    const schemaScript = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const schema = JSON.parse(schemaScript?.innerHTML || '{}') as {
      '@graph': Record<string, unknown>[];
    };

    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute(
      'href',
      '/blog'
    );
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@id': 'https://ogabassey.com/blog#blog',
          '@type': 'Blog',
        }),
      ])
    );
  });
});
