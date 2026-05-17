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
      }) => <section aria-label="generic storefront layout">{children}</section>
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

import OgabasseyLayout, {
  generateMetadata,
  generateViewport,
} from '@/app/(storefront)/ogabassey/layout';

describe('OgabasseyLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mockPrefetchDNS).not.toHaveBeenCalled();
    expect(mockPreconnect).not.toHaveBeenCalled();
    expect(mockPreload).not.toHaveBeenCalled();
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
