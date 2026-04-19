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

let shouldSuspendChrome = false;
const suspendedChromePromise = new Promise<never>(() => {
  // Keep chrome suspended to force the narrow fallback.
});

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

vi.mock('@/components/storefront/ogabassey/storefront-shell-layout', () => ({
  StorefrontShellLayout: ({
    headerChrome,
    footerChrome,
    overlayChrome,
    children,
  }: {
    headerChrome?: ReactNode;
    footerChrome?: ReactNode;
    overlayChrome?: ReactNode;
    children: ReactNode;
  }) => (
    <div data-testid="shell-layout">
      {headerChrome}
      <div data-testid="shell-children">{children}</div>
      {footerChrome}
      {overlayChrome}
    </div>
  ),
}));

vi.mock('@/components/storefront/ogabassey/storefront-chrome-runtime', () => ({
  StorefrontChromeRuntime: ({
    section,
    basePath,
  }: {
    section: 'header' | 'footer' | 'overlay';
    basePath: string;
  }) => {
    if (shouldSuspendChrome) {
      throw suspendedChromePromise;
    }

    return (
      <div data-testid={`chrome-${section}`}>{`${section}:${basePath}`}</div>
    );
  },
}));

vi.mock('@/components/storefront/ogabassey/storefront-loading-ui', () => ({
  ShellChromeLoading: () => (
    <div role="status" aria-label="Loading storefront chrome">
      shared-shell-fallback
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
    shouldSuspendChrome = false;
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

  it('routes the derived base path into the split runtime chrome sections', () => {
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
    expect(mocks.getOgabasseyBasePath).toHaveBeenCalledWith(
      'ogabassey',
      'path'
    );
    expect(screen.getByTestId('chrome-header')).toHaveTextContent(
      'header:/ogabassey'
    );
    expect(screen.getByTestId('chrome-footer')).toHaveTextContent(
      'footer:/ogabassey'
    );
    expect(screen.getByTestId('chrome-overlay')).toHaveTextContent(
      'overlay:/ogabassey'
    );
    expect(screen.getByText('Storefront body')).toBeInTheDocument();
    expect(screen.getByTestId('google-store-widget')).toHaveAttribute(
      'data-enabled',
      'true'
    );
    expect(screen.getByTestId('google-store-widget')).toHaveAttribute(
      'data-domain',
      'ogabassey.com'
    );
  });

  it('passes domain routing mode through to the shared shell chrome', () => {
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
    expect(screen.getByTestId('chrome-header')).toHaveTextContent('header:');
    expect(screen.getByTestId('chrome-footer')).toHaveTextContent('footer:');
    expect(screen.getByTestId('chrome-overlay')).toHaveTextContent('overlay:');
  });

  it('keeps the Google Store widget mounted but disabled when merchant settings turn it off', () => {
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
  });

  it('keeps route content visible while runtime chrome resolves behind a narrow fallback', () => {
    shouldSuspendChrome = true;

    render(
      <OgabasseyStorefrontLayout merchant={merchant}>
        <div>Storefront body</div>
      </OgabasseyStorefrontLayout>
    );

    expect(screen.getByText('Storefront body')).toBeInTheDocument();
    expect(
      screen.getAllByRole('status', { name: 'Loading storefront chrome' })
    ).toHaveLength(2);
  });
});
