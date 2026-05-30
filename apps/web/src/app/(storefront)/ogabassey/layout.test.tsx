import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { mockGetRequestScopedMerchant } = vi.hoisted(() => ({
  mockGetRequestScopedMerchant: vi.fn(() =>
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

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: mockGetRequestScopedMerchant,
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

describe('OgabasseyLayout', () => {
  beforeEach(() => {
    mockStorefrontLayout.mockClear();
    mockGetRequestScopedMerchant.mockClear();
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
    const { unmount } = render(props?.loadingFallback as ReactNode);
    expect(
      screen.getByRole('img', { name: /ogabassey storefront hero/i })
    ).toBeInTheDocument();
    unmount();
    await expect(props?.params).resolves.toEqual({ slug: 'ogabassey' });
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
    expect(metadata.icons).toBeDefined();
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.twitter).toBeDefined();
    expect(metadata.verification?.google).toBe('g-verify-code');
    expect(mockGetRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });
});
