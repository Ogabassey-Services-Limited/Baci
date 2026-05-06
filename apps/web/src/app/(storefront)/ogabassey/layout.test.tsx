import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { mockConnection, mockStorefrontLayout } = vi.hoisted(() => ({
  mockConnection: vi.fn(() => Promise.resolve()),
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
  generateViewport: () => ({
    width: 'device-width',
    initialScale: 1,
  }),
}));

import OgabasseyLayout, { generateViewport } from './layout';

describe('OgabasseyLayout', () => {
  it('delegates to the generic storefront layout with the OgaBassey slug', async () => {
    const result = await OgabasseyLayout({
      children: <p>Home content</p>,
    });

    render(result);

    expect(mockConnection).toHaveBeenCalledOnce();
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
});
