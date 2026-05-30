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

vi.mock('server-only', () => ({}));

vi.mock('@/app/(storefront)/[slug]/layout', () => ({
  default: mockStorefrontLayout,
  generateViewport: () => ({
    width: 'device-width',
    initialScale: 1,
  }),
}));

import OgabasseyLayout, {
  generateViewport,
  metadata,
} from '@/app/(storefront)/ogabassey/layout';

describe('OgabasseyLayout', () => {
  beforeEach(() => {
    mockStorefrontLayout.mockClear();
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

  it('provides high-performance static metadata', () => {
    expect(metadata.title).toBe('OgaBassey - Official Online Store');
    expect(metadata.description).toContain('OgaBassey');
    expect(metadata.manifest).toBeNull();
    expect(metadata.icons).toBeDefined();
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.twitter).toBeDefined();
  });
});
