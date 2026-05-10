import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConnection,
  mockGenerateStorefrontLayoutMetadata,
  mockStorefrontLayout,
} = vi.hoisted(() => ({
  mockConnection: vi.fn(() => Promise.resolve()),
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

  it('delegates to the generic storefront layout without forcing a dynamic connection', async () => {
    const result = OgabasseyLayout({
      children: <p>Home content</p>,
    });

    render(result);

    expect(mockConnection).not.toHaveBeenCalled();
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
