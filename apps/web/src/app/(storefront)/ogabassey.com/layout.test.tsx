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
        params: _params,
      }: {
        children: ReactNode;
        params: Promise<{ slug: string }>;
      }) => <section aria-label="storefront layout">{children}</section>
    ),
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

  it('delegates the custom-domain route with the domain identifier', async () => {
    render(
      <OgabasseyDomainLayout>
        <p>Home content</p>
      </OgabasseyDomainLayout>
    );

    expect(
      screen.getByRole('region', { name: 'storefront layout' })
    ).toHaveTextContent('Home content');

    const props = mockStorefrontLayout.mock.calls[0]?.[0];
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
