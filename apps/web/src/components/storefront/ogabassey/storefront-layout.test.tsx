import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOgabasseyBasePath: vi.fn(),
  getOgabasseyLayoutStyle: vi.fn(),
  shouldEnableOgabasseyGoogleStoreWidget: vi.fn(),
  prefetchDNS: vi.fn(),
  preconnect: vi.fn(),
}));

vi.mock('react-dom', () => ({
  prefetchDNS: mocks.prefetchDNS,
  preconnect: mocks.preconnect,
}));

vi.mock('@/components/analytics/deferred-google-store-widget', () => ({
  DeferredGoogleStoreWidget: ({
    enabled,
    merchantCustomDomain,
  }: {
    enabled: boolean;
    merchantCustomDomain?: string | null;
  }) => (
    <div
      data-testid="google-store-widget"
      data-enabled={String(enabled)}
      data-domain={merchantCustomDomain ?? ''}
    />
  ),
}));

vi.mock('./components/GadgetPattern', () => ({
  GadgetPattern: () => <div data-testid="gadget-pattern" />,
}));

vi.mock('./storefront-layout-providers', () => ({
  OgabasseyLayoutProviders: ({ children }: { children: ReactNode }) => (
    <div data-testid="layout-providers">{children}</div>
  ),
}));

vi.mock('./storefront-layout-chrome', () => ({
  OgabasseyLayoutChrome: ({
    basePath,
    hideNavigation,
    children,
  }: {
    basePath: string;
    hideNavigation?: boolean;
    children: ReactNode;
  }) => (
    <div
      data-testid="layout-chrome"
      data-base-path={basePath}
      data-hide-navigation={String(Boolean(hideNavigation))}
    >
      {children}
    </div>
  ),
}));

vi.mock('./storefront-layout-utils', () => ({
  getOgabasseyBasePath: (...args: unknown[]) => mocks.getOgabasseyBasePath(...args),
  getOgabasseyLayoutStyle: (...args: unknown[]) =>
    mocks.getOgabasseyLayoutStyle(...args),
  shouldEnableOgabasseyGoogleStoreWidget: (...args: unknown[]) =>
    mocks.shouldEnableOgabasseyGoogleStoreWidget(...args),
}));

import { OgabasseyStorefrontLayout } from './storefront-layout';

const merchant = {
  id: 'merchant-1',
  user_id: 'user-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
};

describe('OgabasseyStorefrontLayout', () => {
  beforeEach(() => {
    mocks.getOgabasseyBasePath.mockReset();
    mocks.getOgabasseyLayoutStyle.mockReset();
    mocks.shouldEnableOgabasseyGoogleStoreWidget.mockReset();
    mocks.prefetchDNS.mockClear();
    mocks.preconnect.mockClear();

    mocks.getOgabasseyBasePath.mockReturnValue('/ogabassey');
    mocks.getOgabasseyLayoutStyle.mockReturnValue({
      '--store-primary': '#d62027',
    });
    mocks.shouldEnableOgabasseyGoogleStoreWidget.mockReturnValue(true);
  });

  it('renders the widget, providers, and chrome with the derived base path', () => {
    render(
      <OgabasseyStorefrontLayout merchant={merchant}>
        <div>Storefront body</div>
      </OgabasseyStorefrontLayout>
    );

    expect(mocks.prefetchDNS).toHaveBeenCalledWith('https://cdn.ogabassey.com');
    expect(mocks.preconnect).toHaveBeenCalledWith(
      'https://cdn.ogabassey.com',
      { crossOrigin: '' }
    );
    expect(screen.getByTestId('google-store-widget')).toHaveAttribute(
      'data-enabled',
      'true'
    );
    expect(screen.getByTestId('google-store-widget')).toHaveAttribute(
      'data-domain',
      'ogabassey.com'
    );
    expect(screen.getByTestId('layout-providers')).toBeInTheDocument();
    expect(screen.getByTestId('gadget-pattern')).toBeInTheDocument();
    expect(screen.getByTestId('layout-chrome')).toHaveAttribute(
      'data-base-path',
      '/ogabassey'
    );
    expect(screen.getByText('Storefront body')).toBeInTheDocument();
  });

  it('passes domain routing mode through to the base-path helper', () => {
    mocks.getOgabasseyBasePath.mockReturnValue('');

    render(
      <OgabasseyStorefrontLayout merchant={merchant} routingMode="domain">
        <div>Storefront body</div>
      </OgabasseyStorefrontLayout>
    );

    expect(mocks.getOgabasseyBasePath).toHaveBeenCalledWith(
      'ogabassey',
      'domain'
    );
    expect(screen.getByTestId('layout-chrome')).toHaveAttribute(
      'data-base-path',
      ''
    );
  });

  it('keeps the Google widget mounted but marks it disabled when the setting is off', () => {
    mocks.shouldEnableOgabasseyGoogleStoreWidget.mockReturnValue(false);

    render(
      <OgabasseyStorefrontLayout merchant={merchant}>
        <div>Storefront body</div>
      </OgabasseyStorefrontLayout>
    );

    expect(screen.getByTestId('google-store-widget')).toHaveAttribute(
      'data-enabled',
      'false'
    );
    expect(screen.getByTestId('google-store-widget')).toHaveAttribute(
      'data-domain',
      'ogabassey.com'
    );
    expect(screen.getByTestId('layout-chrome')).toHaveAttribute(
      'data-base-path',
      '/ogabassey'
    );
  });
});
