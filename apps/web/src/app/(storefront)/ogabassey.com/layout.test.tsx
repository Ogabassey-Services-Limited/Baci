import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateStorefrontLayoutMetadata, mockStorefrontLayout } =
  vi.hoisted(() => ({
    mockGenerateStorefrontLayoutMetadata: vi.fn(
      (_props: { params: Promise<{ slug: string }> }) =>
        Promise.resolve({ manifest: null })
    ),
    mockStorefrontLayout: vi.fn(
      ({
        children,
        loadingFallback: _loadingFallback,
        params: _params,
      }: {
        children: ReactNode;
        loadingFallback?: ReactNode;
        params: Promise<{ slug: string }>;
      }) => <section aria-label="storefront layout">{children}</section>
    ),
  }));
const mockHomeStorefrontCssImport = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/app/(storefront)/storefront-home.css', () => {
  mockHomeStorefrontCssImport();
  return {};
});

vi.mock('@/app/(storefront)/[slug]/layout', () => ({
  default: mockStorefrontLayout,
  generateMetadata: mockGenerateStorefrontLayoutMetadata,
  generateViewport: () => ({
    width: 'device-width',
    initialScale: 1,
  }),
}));

import { hasRenderedResourceHintLink } from '@/app/(storefront)/ogabassey/resource-hint-test-utils';
import OgabasseyDomainLayout, {
  generateMetadata,
  generateViewport,
} from '@/app/(storefront)/ogabassey.com/layout';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OgabasseyDomainLayout', () => {
  beforeEach(() => {
    mockGenerateStorefrontLayoutMetadata.mockClear();
    mockStorefrontLayout.mockClear();
  });

  it('loads the reduced homepage stylesheet from the custom-domain layout shell', () => {
    expect(mockHomeStorefrontCssImport).toHaveBeenCalledOnce();
  });

  it('emits OgaBassey LCP resource hints from the custom-domain layout shell', () => {
    const html = renderToString(
      <OgabasseyDomainLayout>
        <p>Home content</p>
      </OgabasseyDomainLayout>
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
    expect(
      hasRenderedResourceHintLink(html, {
        as: 'image',
        fetchpriority: 'high',
        href: HERO_DESKTOP_LCP_SRC,
        media: '(min-width: 768px)',
        rel: 'preload',
        type: 'image/avif',
      })
    ).toBe(true);
    expect(
      hasRenderedResourceHintLink(html, {
        as: 'image',
        fetchpriority: 'high',
        href: HERO_MOBILE_LCP_SRC,
        media: '(max-width: 767px)',
        rel: 'preload',
        type: 'image/avif',
      })
    ).toBe(true);
  });

  it('renders the storefront layout with the domain identifier', async () => {
    const { container } = render(
      <OgabasseyDomainLayout>
        <p>Home content</p>
      </OgabasseyDomainLayout>
    );

    const storefrontLayout = screen.getByRole('region', {
      name: /storefront layout/i,
    });
    expect(container.firstElementChild).toBe(storefrontLayout);
    expect(storefrontLayout).toHaveTextContent('Home content');
    expect(mockStorefrontLayout).toHaveBeenCalledOnce();

    const props = mockStorefrontLayout.mock.calls[0]?.[0];
    expect(props?.loadingFallback).toBeDefined();
    const fallbackRender = render(<div>{props?.loadingFallback}</div>);
    expect(
      fallbackRender.getByRole('status', {
        name: /loading storefront chrome/i,
      })
    ).toBeInTheDocument();
    expect(fallbackRender.container.querySelector('picture')).toBeTruthy();
    fallbackRender.unmount();
    await expect(props?.params).resolves.toEqual({ slug: 'ogabassey.com' });
  });

  it('delegates merchant-level metadata with the domain identifier', async () => {
    const metadata = await generateMetadata();

    expect(metadata.manifest).toBeNull();
    const props = mockGenerateStorefrontLayoutMetadata.mock.calls[0]?.[0];
    await expect(props?.params).resolves.toEqual({ slug: 'ogabassey.com' });
  });

  it('falls back when merchant-level metadata delegation fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGenerateStorefrontLayoutMetadata.mockRejectedValueOnce(
      new Error('metadata failed')
    );

    await expect(generateMetadata()).resolves.toEqual({ manifest: null });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load OgaBassey domain layout metadata',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('keeps the storefront viewport settings', () => {
    expect(generateViewport()).toEqual({
      width: 'device-width',
      initialScale: 1,
    });
  });
});
