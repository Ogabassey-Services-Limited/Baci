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

const mockUsePathname = vi.fn(() => '/ogabassey');
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
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
  beforeEach(() => {
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue('/ogabassey');
  });

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

  // Reactive hide-on-pathname coverage — this is the P1 regression fix.
  // The shell is persistent across client-side routing, so hide state must
  // derive from `usePathname()` and update without remounting the chrome.
  it('auto-hides the navbar when the current pathname is a checkout route', () => {
    mockUsePathname.mockReturnValue('/ogabassey/checkout');
    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="header" />);

    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    // GoogleAdManager is outside the hide gate — it still renders.
    expect(screen.getByTestId('google-ad-manager')).toBeInTheDocument();
  });

  it('auto-hides the footer chrome on nav-less routes', () => {
    mockUsePathname.mockReturnValue('/ogabassey/account/login');
    const { container } = render(
      <OgabasseyLayoutChrome basePath="/ogabassey" section="footer" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the navbar visible on a normal storefront route', () => {
    mockUsePathname.mockReturnValue('/ogabassey/products/some-item');
    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="header" />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('still honours an explicit hideNavigation override on any route', () => {
    mockUsePathname.mockReturnValue('/ogabassey/products/some-item');
    render(
      <OgabasseyLayoutChrome
        basePath="/ogabassey"
        hideNavigation
        section="header"
      />
    );

    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
  });
});
