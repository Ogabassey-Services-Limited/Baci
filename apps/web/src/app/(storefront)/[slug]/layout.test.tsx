import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CachedMerchant,
  getRequestScopedMerchant,
} from '@/lib/cached-data';

vi.mock('@/components/storefront/ogabassey/storefront-layout', () => ({
  OgabasseyStorefrontLayout: ({ children }: { children: ReactNode }) =>
    children,
}));

vi.mock('@/components/storefront/deferred-page-view-tracker', () => ({
  DeferredPageViewTracker: () => null,
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: () => null,
}));

vi.mock('@/hooks/cart/storefront-cart-provider', () => ({
  StorefrontCartProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/hooks/merchant/storefront-merchant-provider', () => ({
  StorefrontMerchantProvider: ({ children }: { children: ReactNode }) =>
    children,
}));

vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
  buildRequestScopedStoreUrl: (
    merchant: { slug: string; custom_domain?: string },
    _headers: Headers
  ) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
  isValidMerchantIdentifier: () => true,
}));

const { default: StorefrontLayout, generateMetadata } = await import(
  './layout'
);

describe('storefront layout metadata', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it('renders a route-aware blog fallback while the layout content is loading', async () => {
    vi.mocked(getRequestScopedMerchant).mockReturnValue(
      new Promise<CachedMerchant | null>(() => {
        // Keep the layout content pending so the Suspense fallback renders.
      })
    );
    mockHeaders.mockResolvedValue(new Headers([['x-pathname', '/blog']]));

    render(
      await StorefrontLayout({
        params: Promise.resolve({ slug: 'test-store' }),
        children: <main>Storefront content</main>,
      })
    );

    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
  });

  it('renders a route-aware product fallback for product paths', async () => {
    vi.mocked(getRequestScopedMerchant).mockReturnValue(
      new Promise<CachedMerchant | null>(() => {
        // Keep the layout content pending so the Suspense fallback renders.
      })
    );
    mockHeaders.mockResolvedValue(
      new Headers([['x-pathname', '/smartphones/samsung-galaxy-z-trifold']])
    );

    render(
      await StorefrontLayout({
        params: Promise.resolve({ slug: 'test-store' }),
        children: <main>Storefront content</main>,
      })
    );

    expect(
      screen.getByRole('status', { name: 'Loading product page' })
    ).toBeInTheDocument();
  });

  it('uses the merchant domain as metadataBase for custom domains', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      business_name: 'Ogabassey',
      site_title: 'Ogabassey | Buy Gadgets Pay Later',
      site_description: 'Store description',
      site_tagline: 'Store tagline',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      logo_url: null,
      favicon_svg_url: null,
      favicon_png_32_url: null,
      favicon_apple_touch_url: null,
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.metadataBase?.toString()).toBe('https://ogabassey.com/');
  });

  it('falls back to the slug-based storefront URL when no custom domain exists', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      business_name: 'Test Store',
      site_title: 'Test Store',
      site_description: 'Store description',
      site_tagline: 'Store tagline',
      slug: 'test-store',
      custom_domain: null,
      logo_url: null,
      favicon_svg_url: null,
      favicon_png_32_url: null,
      favicon_apple_touch_url: null,
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.metadataBase?.toString()).toBe(
      'https://test-store.usebaci.com/'
    );
  });

  it('reads google verification from published_config when feature settings omit it', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      business_name: 'Test Store',
      site_title: 'Test Store',
      site_description: 'Store description',
      site_tagline: 'Store tagline',
      slug: 'test-store',
      custom_domain: null,
      logo_url: null,
      favicon_svg_url: null,
      favicon_png_32_url: null,
      favicon_apple_touch_url: null,
      feature_settings: {},
      published_config: {
        google_site_verification: 'google-verification-token',
      },
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.verification).toEqual({
      google: 'google-verification-token',
    });
  });
});
