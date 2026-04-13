import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/components/storefront/merchant-slug-sync', () => ({
  MerchantSlugSync: () => null,
}));

vi.mock('@/components/storefront/ogabassey/layout', () => ({
  OgabasseyLayout: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/storefront/page-view-tracker', () => ({
  PageViewTracker: () => null,
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: () => null,
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductGridSkeleton: () => <div>Storefront grid loading</div>,
  Skeleton: () => <div>Storefront shell loading</div>,
}));

vi.mock('@/hooks/use-cart', () => ({
  CartProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/hooks/use-merchant', () => ({
  MerchantProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string }) =>
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
  });

  it('renders a local storefront fallback while the layout content is loading', () => {
    vi.mocked(getRequestScopedMerchant).mockReturnValue(
      new Promise(() => {
        // Keep the layout content pending so the Suspense fallback renders.
      }) as Awaited<ReturnType<typeof getRequestScopedMerchant>>
    );

    render(
      <StorefrontLayout params={Promise.resolve({ slug: 'test-store' })}>
        <main>Storefront content</main>
      </StorefrontLayout>
    );

    expect(screen.getByText('Storefront grid loading')).toBeInTheDocument();
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
});
