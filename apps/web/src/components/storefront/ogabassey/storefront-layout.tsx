import { DeferredGoogleStoreWidget } from '@/components/analytics/deferred-google-store-widget';
import { StorefrontChromeRuntime } from '@/components/storefront/ogabassey/storefront-chrome-runtime';
import { ShellChromeLoading } from '@/components/storefront/ogabassey/storefront-loading-ui';
import { StorefrontShellLayout } from '@/components/storefront/ogabassey/storefront-shell-layout';
import type { MerchantData } from '@/hooks/use-merchant';
import type React from 'react';
import * as ReactDOM from 'react-dom';
import { Suspense } from 'react';
import { type V2ThemeMode } from './providers/v2-theme-context';
import {
  getOgabasseyBasePath,
  shouldEnableOgabasseyGoogleStoreWidget,
} from './storefront-layout-utils';
import { OGABASSEY_CDN_ORIGIN } from './config/storefront-origins';

interface OgabasseyStorefrontLayoutProps {
  children: React.ReactNode;
  merchant?: MerchantData;
  initialTheme?: V2ThemeMode;
  hideNavigation?: boolean;
  routingMode?: 'domain' | 'path';
}

export function OgabasseyStorefrontLayout({
  children,
  merchant,
  initialTheme,
  hideNavigation = false,
  routingMode = 'path',
}: OgabasseyStorefrontLayoutProps) {
  ReactDOM.prefetchDNS(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preconnect(OGABASSEY_CDN_ORIGIN);

  const basePath = getOgabasseyBasePath(merchant?.slug, routingMode);
  const shouldEnableGoogleStoreWidget =
    shouldEnableOgabasseyGoogleStoreWidget(merchant);

  return (
    <>
      {merchant && (
        <DeferredGoogleStoreWidget
          merchantCustomDomain={merchant.custom_domain}
          enabled={shouldEnableGoogleStoreWidget}
        />
      )}

      <StorefrontShellLayout
        footerChrome={
          <Suspense fallback={<ShellChromeLoading />}>
            <StorefrontChromeRuntime
              basePath={basePath}
              hideNavigation={hideNavigation}
              merchant={merchant}
              section="footer"
            />
          </Suspense>
        }
        headerChrome={
          <Suspense fallback={<ShellChromeLoading />}>
            <StorefrontChromeRuntime
              basePath={basePath}
              hideNavigation={hideNavigation}
              merchant={merchant}
              section="header"
            />
          </Suspense>
        }
        initialTheme={initialTheme}
        merchant={merchant}
        overlayChrome={
          <Suspense fallback={null}>
            <StorefrontChromeRuntime
              basePath={basePath}
              hideNavigation={hideNavigation}
              merchant={merchant}
              section="overlay"
            />
          </Suspense>
        }
      >
        {children}
      </StorefrontShellLayout>
    </>
  );
}
