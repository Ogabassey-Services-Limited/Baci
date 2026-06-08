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
let deferredShellActive = false;
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
  DeferredShellFeature: ({
    children,
    fallback = null,
    timeoutMs,
  }: {
    children: ReactNode;
    fallback?: ReactNode;
    timeoutMs?: number;
  }) => (
    <div
      data-testid="deferred-shell"
      data-timeout-ms={String(timeoutMs ?? '')}
    >
      {deferredShellActive ? children : fallback}
    </div>
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

vi.mock('./storefront-deferred-footer-chrome', () => ({
  StorefrontDeferredFooterChrome: ({
    basePath,
  }: {
    basePath: string;
  }) => (
    <div data-testid="deferred-footer-commerce">
      <div data-testid="ad-unit">FOOTER_BANNER</div>
      <div data-testid="dynamic-slot" />
      <div data-testid="deferred-cart-sidebar" />
      <div data-testid="deferred-chat-widget" />
      <span>{basePath}</span>
    </div>
  ),
}));

vi.mock('./storefront-deferred-overlay-chrome', () => ({
  StorefrontDeferredOverlayChrome: () => (
    <div data-testid="deferred-overlay-chrome">
      <div data-testid="dynamic-slot" />
      <div data-testid="dynamic-slot" />
    </div>
  ),
}));

import { OgabasseyLayoutChrome } from './storefront-layout-chrome';

describe('OgabasseyLayoutChrome', () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue('/ogabassey');
    deferredShellActive = false;
  });

  it('renders only header chrome for the header section', () => {
    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="header" />);

    expect(screen.getByTestId('google-ad-manager')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toHaveTextContent('/ogabassey');
    expect(screen.queryByTestId('ad-unit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deferred-chat-widget')).not.toBeInTheDocument();
  });

  it('renders mobile footer immediately and defers footer commerce chrome', () => {
    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="footer" />);

    expect(screen.getByTestId('mobile-footer')).toHaveTextContent('/ogabassey');
    expect(screen.queryByTestId('ad-unit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deferred-cart-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deferred-chat-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-slot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('mounts deferred footer commerce chrome after activation', async () => {
    deferredShellActive = true;

    render(<OgabasseyLayoutChrome basePath="/ogabassey" section="footer" />);

    expect(await screen.findByTestId('deferred-footer-commerce')).toHaveTextContent(
      '/ogabassey'
    );
    expect(screen.getByTestId('ad-unit')).toHaveTextContent('FOOTER_BANNER');
    expect(screen.getByTestId('deferred-cart-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-chat-widget')).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-slot')).toHaveLength(1);
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

  it('renders overlay chrome independently from header and footer sections', async () => {
    deferredShellActive = true;

    render(
      <OgabasseyLayoutChrome
        basePath="/ogabassey"
        hideNavigation
        section="overlay"
      />
    );

    expect(await screen.findByTestId('deferred-overlay-chrome')).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-slot')).toHaveLength(2);
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ad-unit')).not.toBeInTheDocument();
  });

  it('defers overlay chrome until activation', () => {
    render(
      <OgabasseyLayoutChrome
        basePath="/ogabassey"
        hideNavigation
        section="overlay"
      />
    );

    expect(screen.queryByTestId('deferred-overlay-chrome')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-slot')).not.toBeInTheDocument();
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
