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
        enableDynamicHeroPreloadDecision: _enableDynamicHeroPreloadDecision,
        loadingFallback: _loadingFallback,
        params: _params,
      }: {
        children: ReactNode;
        enableDynamicHeroPreloadDecision?: boolean;
        loadingFallback?: ReactNode;
        params: Promise<{ slug: string }>;
      }) => <section aria-label="storefront layout">{children}</section>
    ),
  }));
const { mockPreconnect, mockPrefetchDNS, mockPreload } = vi.hoisted(() => ({
  mockPreconnect: vi.fn(),
  mockPrefetchDNS: vi.fn(),
  mockPreload: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('react-dom', () => ({
  preconnect: mockPreconnect,
  prefetchDNS: mockPrefetchDNS,
  preload: mockPreload,
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
    vi.clearAllMocks();
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
    expect(props?.enableDynamicHeroPreloadDecision).toBe(false);
    expect(props?.loadingFallback).toBeDefined();
    await expect(props?.params).resolves.toEqual({ slug: 'ogabassey.com' });
    expect(mockPrefetchDNS).not.toHaveBeenCalled();
    expect(mockPreconnect).not.toHaveBeenCalled();
    expect(mockPreload).not.toHaveBeenCalled();
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
