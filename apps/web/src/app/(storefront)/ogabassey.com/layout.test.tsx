import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
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
const mockOgabasseyStaticResourceHints = vi.hoisted(() => vi.fn(() => null));

vi.mock('server-only', () => ({}));

vi.mock('@/app/(storefront)/storefront-home.css', () => {
  mockHomeStorefrontCssImport();
  return {};
});

vi.mock('@/app/(storefront)/ogabassey/ogabassey-static-resource-hints', () => ({
  OgabasseyStaticResourceHints: mockOgabasseyStaticResourceHints,
}));

vi.mock('@/app/(storefront)/[slug]/layout', () => ({
  default: mockStorefrontLayout,
  generateMetadata: mockGenerateStorefrontLayoutMetadata,
  generateViewport: () => ({
    width: 'device-width',
    initialScale: 1,
  }),
}));

import OgabasseyDomainLayout, {
  generateMetadata,
  generateViewport,
} from '@/app/(storefront)/ogabassey.com/layout';

describe('OgabasseyDomainLayout', () => {
  beforeEach(() => {
    mockGenerateStorefrontLayoutMetadata.mockClear();
    mockStorefrontLayout.mockClear();
    mockOgabasseyStaticResourceHints.mockClear();
  });

  it('loads the reduced homepage stylesheet from the custom-domain layout shell', () => {
    expect(mockHomeStorefrontCssImport).toHaveBeenCalledOnce();
  });

  it('loads OgaBassey LCP resource hints from the custom-domain layout shell', () => {
    render(
      <OgabasseyDomainLayout>
        <p>Home content</p>
      </OgabasseyDomainLayout>
    );

    expect(mockOgabasseyStaticResourceHints).toHaveBeenCalledOnce();
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
