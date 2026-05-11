import { DeferredGoogleStoreWidget } from '@/components/analytics/deferred-google-store-widget';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
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

interface OgabasseyStorefrontLayoutProps {
  children: React.ReactNode;
  merchant?: MerchantData;
  initialTheme?: V2ThemeMode;
  hideNavigation?: boolean;
  routingMode?: 'domain' | 'path';
  preloadHeroLcpImages?: boolean;
}

export function OgabasseyStorefrontLayout({
  children,
  merchant,
  initialTheme,
  hideNavigation = false,
  routingMode = 'path',
  preloadHeroLcpImages = false,
}: OgabasseyStorefrontLayoutProps) {
  ReactDOM.prefetchDNS(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preconnect(OGABASSEY_CDN_ORIGIN);
  if (preloadHeroLcpImages) {
    ReactDOM.preload(HERO_DESKTOP_LCP_SRC, {
      as: 'image',
      fetchPriority: 'high',
      media: '(min-width: 768px)',
      type: 'image/avif',
    });
    ReactDOM.preload(HERO_MOBILE_LCP_SRC, {
      as: 'image',
      fetchPriority: 'high',
      media: '(max-width: 767px)',
      type: 'image/avif',
    });
  }

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
