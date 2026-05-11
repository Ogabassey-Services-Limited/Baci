import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConnection,
  mockPreconnect,
  mockPrefetchDNS,
  mockPreload,
  mockGenerateStorefrontLayoutMetadata,
  mockStorefrontLayout,
} = vi.hoisted(() => ({
  mockConnection: vi.fn(() => Promise.resolve()),
  mockPreconnect: vi.fn(),
  mockPrefetchDNS: vi.fn(),
  mockPreload: vi.fn(),
  mockGenerateStorefrontLayoutMetadata: vi.fn(
    (_props: { params: Promise<{ slug: string }> }) =>
      Promise.resolve({ manifest: null })
  ),
  mockStorefrontLayout: vi.fn(
    ({
      children,
      params: _params,
    }: {
      children: ReactNode;
      params: Promise<{ slug: string }>;
    }) => <div data-testid="storefront-layout">{children}</div>
  ),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

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

import OgabasseyLayout, {
  generateMetadata,
  generateViewport,
} from '@/app/(storefront)/ogabassey/layout';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OgabasseyLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to the generic storefront layout without forcing a dynamic connection', async () => {
    const result = OgabasseyLayout({
      children: <p>Home content</p>,
    });

    const { container } = render(result);

    expect(mockConnection).not.toHaveBeenCalled();
    expect(mockPrefetchDNS).toHaveBeenCalledWith(OGABASSEY_CDN_ORIGIN);
    expect(mockPreconnect).toHaveBeenCalledWith(OGABASSEY_CDN_ORIGIN);
    expect(mockPreload).toHaveBeenCalledWith(
      HERO_DESKTOP_LCP_SRC,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        media: '(min-width: 768px)',
        type: 'image/avif',
      })
    );
    expect(mockPreload).toHaveBeenCalledWith(
      HERO_MOBILE_LCP_SRC,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        media: '(max-width: 767px)',
        type: 'image/avif',
      })
    );
    const storefrontLayoutCallOrder =
      mockStorefrontLayout.mock.invocationCallOrder[0] ??
      Number.POSITIVE_INFINITY;
    const staticHintCallOrders = [
      ...mockPrefetchDNS.mock.invocationCallOrder,
      ...mockPreconnect.mock.invocationCallOrder,
      ...mockPreload.mock.invocationCallOrder,
    ];
    expect(Math.max(...staticHintCallOrders)).toBeLessThan(
      storefrontLayoutCallOrder
    );
    expect(container.firstElementChild).toBe(
      screen.getByTestId('storefront-layout')
    );
    expect(screen.getByTestId('storefront-layout')).toHaveTextContent(
      'Home content'
    );

    const props = mockStorefrontLayout.mock.calls[0]?.[0];
    await expect(props?.params).resolves.toEqual({ slug: 'ogabassey' });
  });

  it('keeps the storefront viewport settings', () => {
    expect(generateViewport()).toEqual({
      width: 'device-width',
      initialScale: 1,
    });
  });

  it('delegates merchant-level metadata to the generic storefront layout', async () => {
    const metadata = await generateMetadata();

    expect(metadata.manifest).toBeNull();
    expect(mockGenerateStorefrontLayoutMetadata).toHaveBeenCalledWith({
      params: expect.any(Promise),
    });
    const props = mockGenerateStorefrontLayoutMetadata.mock.calls[0]?.[0];
    await expect(props?.params).resolves.toEqual({ slug: 'ogabassey' });
  });

  it('keeps the platform manifest disabled when merchant metadata fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGenerateStorefrontLayoutMetadata.mockRejectedValueOnce(
      new Error('metadata failed')
    );

    try {
      await expect(generateMetadata()).resolves.toEqual({
        manifest: null,
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
