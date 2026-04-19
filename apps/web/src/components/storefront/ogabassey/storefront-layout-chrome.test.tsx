import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: () => {
    return function DynamicSlot() {
      return <div data-testid="dynamic-slot" />;
    };
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/ogabassey',
}));

vi.mock('./layout/navbar', () => ({
  OgabasseyNavbar: ({ storeSlug }: { storeSlug: string }) => (
    <div data-testid="navbar">{storeSlug}</div>
  ),
}));

vi.mock('./components/AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div data-testid="ad-unit">{placementKey}</div>
  ),
}));

vi.mock('./components/deferred-shell-feature', () => ({
  DeferredShellFeature: ({ children }: { children: ReactNode }) => (
    <div data-testid="deferred-shell">{children}</div>
  ),
}));

vi.mock('./components/GoogleAdManager', () => ({
  GoogleAdManager: () => <div data-testid="google-ad-manager" />,
}));

vi.mock('./components/MobileFooter', () => ({
  MobileFooter: ({ storeSlug }: { storeSlug: string }) => (
    <div data-testid="mobile-footer">{storeSlug}</div>
  ),
}));

vi.mock('./components/chat/DeferredChatWidget', () => ({
  DeferredChatWidget: () => <div data-testid="deferred-chat-widget" />,
}));

import { OgabasseyLayoutChrome } from './storefront-layout-chrome';

describe('OgabasseyLayoutChrome', () => {
  it('renders only header chrome for the header section', () => {
    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="header" />);

    expect(screen.getByTestId('google-ad-manager')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toHaveTextContent('/ogabassey');
    expect(screen.queryByTestId('ad-unit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deferred-chat-widget')).not.toBeInTheDocument();
  });

  it('renders footer commerce chrome without wrapping route content', () => {
    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="footer" />);

    expect(screen.getByTestId('ad-unit')).toHaveTextContent('FOOTER_BANNER');
    expect(screen.getByTestId('mobile-footer')).toHaveTextContent('/ogabassey');
    expect(screen.getByTestId('deferred-chat-widget')).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-slot')).toHaveLength(2);
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('hides navigation-dependent chrome when hideNavigation is true', () => {
    const { container } = render(
      <OgabasseyLayoutChrome
        basePath="/ogabassey"
        hideNavigation
        section="footer"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders overlay chrome independently from header and footer sections', () => {
    render(
      <OgabasseyLayoutChrome
        basePath="/ogabassey"
        hideNavigation
        section="overlay"
      />
    );

    expect(screen.getAllByTestId('dynamic-slot')).toHaveLength(2);
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ad-unit')).not.toBeInTheDocument();
  });
});
