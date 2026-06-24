import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockStorefrontMerchant = {
  id: string;
  slug: string;
  business_name: string;
  business_type: string;
  site_title: string;
  site_description: string;
  logo_url: string;
  favicon_svg_url: string | null;
  favicon_png_32_url: string | null;
  favicon_apple_touch_url: string | null;
  feature_settings: {
    google_site_verification: string;
  };
  published_config: null;
};

const { mockStorefrontLayout } = vi.hoisted(() => ({
  mockStorefrontLayout: vi.fn(
    ({
      children,
      loadingFallback: _loadingFallback,
      params: _params,
    }: {
      children: ReactNode;
      loadingFallback?: ReactNode;
      params: Promise<{ slug: string }>;
    }) => <section aria-label="generic storefront layout">{children}</section>
  ),
}));
const mockCriticalHomeCssImport = vi.hoisted(() => vi.fn());
const mockFullHomeCssImport = vi.hoisted(() => vi.fn());

const { mockGetRequestScopedMerchant } = vi.hoisted(() => ({
  mockGetRequestScopedMerchant: vi.fn<
    (slug: string) => Promise<MockStorefrontMerchant | null>
  >(() =>
    Promise.resolve({
      id: 'ogabassey',
      slug: 'ogabassey',
      business_name: 'OgaBassey',
      business_type: 'electronics',
      site_title: 'OgaBassey - Official Online Store',
      site_description: 'Buy Gadgets Pay Later',
      logo_url: 'https://ogabassey.cdn/logo.png',
      favicon_svg_url: null,
      favicon_png_32_url: null,
      favicon_apple_touch_url: null,
      feature_settings: {
        google_site_verification: 'g-verify-code',
      },
      published_config: null,
    })
  ),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/app/(storefront)/storefront-home-critical.css', () => {
  mockCriticalHomeCssImport();
  return {};
});

vi.mock('@/app/(storefront)/storefront-home.css', () => {
  mockFullHomeCssImport();
  return {};
});

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: mockGetRequestScopedMerchant,
}));

vi.mock('./ogabassey-home-hero-section', () => ({
  OgabasseyHomeHeroSection: ({ pathPrefix }: { pathPrefix: string }) => (
    <section aria-label="Product hero" data-prefix={pathPrefix} />
  ),
}));

vi.mock('@/app/(storefront)/[slug]/layout', () => ({
  default: mockStorefrontLayout,
  generateViewport: () => ({
    width: 'device-width',
    initialScale: 1,
  }),
}));

import OgabasseyLayout, {
  generateMetadata,
  generateViewport,
} from '@/app/(storefront)/ogabassey/layout';
import { hasRenderedResourceHintLink } from '@/app/(storefront)/ogabassey/resource-hint-test-utils';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

describe('OgabasseyLayout', () => {
  it('loads only the critical homepage stylesheet from the layout shell', () => {
    expect(mockCriticalHomeCssImport).toHaveBeenCalledOnce();
    expect(mockFullHomeCssImport).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    mockStorefrontLayout.mockClear();
    mockGetRequestScopedMerchant.mockClear();
  });

  it('keeps static resource hints connection-only and leaves mobile LCP inline', () => {
    const html = renderToString(
      <OgabasseyLayout>
        <p>Home content</p>
      </OgabasseyLayout>
    );
    expect(
      hasRenderedResourceHintLink(html, {
        href: OGABASSEY_CDN_ORIGIN,
        rel: 'dns-prefetch',
      })
    ).toBe(true);
    expect(
      hasRenderedResourceHintLink(html, {
        href: OGABASSEY_CDN_ORIGIN,
        rel: 'preconnect',
      })
    ).toBe(true);
    expect(html.includes('rel="preload"')).toBe(false);
    expect(
      hasRenderedResourceHintLink(html, {
        as: 'image',
        media: '(max-width: 767px)',
        rel: 'preload',
      })
    ).toBe(false);
  });

  it('renders the storefront layout with the static OgaBassey identifier', async () => {
    const result = OgabasseyLayout({
      children: <p>Home content</p>,
    });

    const { container } = render(result);

    expect(mockStorefrontLayout).toHaveBeenCalledOnce();
    const storefrontLayout = screen.getByRole('region', {
      name: /generic storefront layout/i,
    });
    expect(container.firstElementChild).toBe(storefrontLayout);
    expect(storefrontLayout).toHaveTextContent('Home content');

    const props = mockStorefrontLayout.mock.calls[0]?.[0];
    expect(props?.loadingFallback).toBeDefined();
    const fallbackRender = render(<div>{props?.loadingFallback}</div>);
    expect(
      fallbackRender.getByRole('status', {
        name: /loading storefront chrome/i,
      })
    ).toBeInTheDocument();
    expect(
      fallbackRender.container.querySelector(
        '.storefront-shell-loading__chrome'
      )
    ).toBeInTheDocument();
    const fallbackHero = fallbackRender.getByRole('region', {
      name: /product hero/i,
    });
    expect(fallbackHero).toHaveAttribute('data-prefix', '');
    fallbackRender.unmount();
    await expect(props?.params).resolves.toEqual({
      slug: OGABASSEY_TEMPLATE_ID,
    });
  });

  it('keeps the storefront viewport settings', () => {
    expect(generateViewport()).toEqual({
      width: 'device-width',
      initialScale: 1,
    });
  });

  it('provides high-performance dynamic metadata from the database', async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe('OgaBassey - Official Online Store');
    expect(metadata.description).toContain('Buy Gadgets Pay Later');
    expect(metadata.manifest).toBeNull();
    expect(metadata.other).toMatchObject({
      'apple-itunes-app': 'app-id=6472735367',
    });
    expect(metadata.icons).toBeDefined();
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.twitter).toBeDefined();
    expect(metadata.verification?.google).toBe('g-verify-code');
    expect(mockGetRequestScopedMerchant).toHaveBeenCalledWith(
      OGABASSEY_TEMPLATE_ID
    );
  });

  it('falls back to static OgaBassey metadata when merchant data is unavailable', async () => {
    mockGetRequestScopedMerchant.mockResolvedValueOnce(null);

    const metadata = await generateMetadata();

    expect(metadata).toMatchObject({
      title: 'OgaBassey - Official Online Store',
      description: 'OgaBassey Storefront',
      manifest: null,
      other: {
        'apple-itunes-app': 'app-id=6472735367',
      },
    });
  });
});
