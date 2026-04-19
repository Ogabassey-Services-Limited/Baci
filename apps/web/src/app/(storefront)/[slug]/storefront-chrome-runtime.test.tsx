import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/storefront/ogabassey/storefront-layout-chrome', () => ({
  OgabasseyLayoutChrome: ({
    section,
    hideNavigation,
    basePath,
  }: {
    section: 'header' | 'footer' | 'overlay';
    hideNavigation?: boolean;
    basePath: string;
  }) => (
    <div
      data-testid="runtime-chrome"
      data-section={section}
      data-hide-navigation={String(Boolean(hideNavigation))}
      data-base-path={basePath}
    />
  ),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

import { StorefrontChromeRuntime } from './storefront-chrome-runtime';

describe('StorefrontChromeRuntime', () => {
  beforeEach(() => {
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers([['x-pathname', '/checkout']]));
  });

  it('derives hideNavigation from checkout-like request headers and forwards the shell section props', async () => {
    render(
      await StorefrontChromeRuntime({
        section: 'header',
        basePath: '/ogabassey',
      })
    );

    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-section',
      'header'
    );
    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-hide-navigation',
      'true'
    );
    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-base-path',
      '/ogabassey'
    );
  });

  it('keeps navigation visible for normal storefront paths', async () => {
    mockHeaders.mockResolvedValue(new Headers([['x-pathname', '/products']]));

    render(
      await StorefrontChromeRuntime({
        section: 'footer',
        basePath: '/ogabassey',
      })
    );

    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-section',
      'footer'
    );
    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-hide-navigation',
      'false'
    );
  });

  it('keeps navigation visible when the request pathname header is missing', async () => {
    mockHeaders.mockResolvedValue(new Headers());

    render(
      await StorefrontChromeRuntime({
        section: 'overlay',
        basePath: '/ogabassey',
      })
    );

    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-section',
      'overlay'
    );
    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-hide-navigation',
      'false'
    );
  });

  it('preserves an explicit hideNavigation override even on normal storefront paths', async () => {
    mockHeaders.mockResolvedValue(new Headers([['x-pathname', '/products']]));

    render(
      await StorefrontChromeRuntime({
        section: 'header',
        basePath: '/ogabassey',
        hideNavigation: true,
      })
    );

    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-hide-navigation',
      'true'
    );
  });
});
