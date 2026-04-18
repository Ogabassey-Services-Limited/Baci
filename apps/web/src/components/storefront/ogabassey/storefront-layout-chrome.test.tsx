import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/ogabassey',
  shouldHideNavigation: vi.fn(),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function DynamicSlot() {
      return <div data-testid="dynamic-slot" />;
    };
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
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

vi.mock('./storefront-layout-utils', () => ({
  shouldHideOgabasseyNavigation: (...args: unknown[]) =>
    mocks.shouldHideNavigation(...args),
}));

import { OgabasseyLayoutChrome } from './storefront-layout-chrome';

describe('OgabasseyLayoutChrome', () => {
  beforeEach(() => {
    mocks.pathname = '/ogabassey';
    mocks.shouldHideNavigation.mockReset();
  });

  it('renders the storefront shell features when navigation stays visible', () => {
    mocks.shouldHideNavigation.mockReturnValue(false);

    render(
      <OgabasseyLayoutChrome basePath="/ogabassey">
        <div>Storefront body</div>
      </OgabasseyLayoutChrome>
    );

    expect(mocks.shouldHideNavigation).toHaveBeenCalledWith('/ogabassey', false);
    expect(screen.getByTestId('google-ad-manager')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toHaveTextContent('/ogabassey');
    expect(screen.getByText('Storefront body')).toBeInTheDocument();
    expect(screen.getByTestId('ad-unit')).toHaveTextContent('FOOTER_BANNER');
    expect(screen.getByTestId('mobile-footer')).toHaveTextContent('/ogabassey');
    expect(screen.getByTestId('deferred-chat-widget')).toBeInTheDocument();
    // Footer, cart sidebar, popup system, and offline notice all resolve through next/dynamic here.
    expect(screen.getAllByTestId('dynamic-slot')).toHaveLength(4);
  });

  it('hides the navigation-dependent chrome for checkout-like routes', () => {
    mocks.shouldHideNavigation.mockReturnValue(true);

    render(
      <OgabasseyLayoutChrome basePath="/ogabassey">
        <div>Storefront body</div>
      </OgabasseyLayoutChrome>
    );

    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ad-unit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deferred-chat-widget')).not.toBeInTheDocument();
    // When navigation is hidden, only the popup system and offline notice dynamic slots remain.
    expect(screen.getAllByTestId('dynamic-slot')).toHaveLength(2);
    expect(screen.getByText('Storefront body')).toBeInTheDocument();
  });
});
