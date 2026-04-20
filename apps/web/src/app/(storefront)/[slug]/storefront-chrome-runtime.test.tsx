import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

import { StorefrontChromeRuntime } from './storefront-chrome-runtime';

describe('StorefrontChromeRuntime', () => {
  // The runtime used to derive `hideNavigation` from `x-pathname` at render
  // time, but the `[slug]` shell is persistent across client-side routing
  // so that server value goes stale after in-app navigation. Pathname-based
  // hiding now lives in the client-side `OgabasseyLayoutChrome`. These tests
  // only assert pass-through of props to that client component.
  it('forwards the shell section props with hideNavigation defaulting to false', () => {
    render(<StorefrontChromeRuntime section="header" basePath="/ogabassey" />);

    const chrome = screen.getByTestId('runtime-chrome');
    expect(chrome).toHaveAttribute('data-section', 'header');
    expect(chrome).toHaveAttribute('data-hide-navigation', 'false');
    expect(chrome).toHaveAttribute('data-base-path', '/ogabassey');
  });

  it('forwards an explicit hideNavigation override as an escape hatch', () => {
    render(
      <StorefrontChromeRuntime
        section="header"
        basePath="/ogabassey"
        hideNavigation
      />
    );

    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-hide-navigation',
      'true'
    );
  });

  it('forwards the section identifier for footer and overlay chrome', () => {
    const { rerender } = render(
      <StorefrontChromeRuntime section="footer" basePath="/ogabassey" />
    );
    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-section',
      'footer'
    );

    rerender(
      <StorefrontChromeRuntime section="overlay" basePath="/ogabassey" />
    );
    expect(screen.getByTestId('runtime-chrome')).toHaveAttribute(
      'data-section',
      'overlay'
    );
  });
});
