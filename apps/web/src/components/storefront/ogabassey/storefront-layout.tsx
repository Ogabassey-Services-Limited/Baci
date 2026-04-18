import { DeferredGoogleStoreWidget } from '@/components/analytics/deferred-google-store-widget';
import type { MerchantData } from '@/hooks/use-merchant';
import type React from 'react';
import * as ReactDOM from 'react-dom';
import { GadgetPattern } from './components/GadgetPattern';
import { type V2ThemeMode } from './providers/v2-theme-context';
import { OgabasseyLayoutChrome } from './storefront-layout-chrome';
import { OgabasseyLayoutProviders } from './storefront-layout-providers';
import {
  getOgabasseyBasePath,
  getOgabasseyLayoutStyle,
  shouldEnableOgabasseyGoogleStoreWidget,
} from './storefront-layout-utils';

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
  ReactDOM.prefetchDNS('https://cdn.ogabassey.com');
  ReactDOM.preconnect('https://cdn.ogabassey.com', {
    crossOrigin: '',
  });

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

      <OgabasseyLayoutProviders initialTheme={initialTheme}>
        <div
          className="text-gray-900 bg-[#0F0F0F] min-h-screen flex flex-col relative overflow-hidden"
          style={getOgabasseyLayoutStyle(merchant)}
        >
          <GadgetPattern />
          <OgabasseyLayoutChrome
            merchant={merchant}
            basePath={basePath}
            hideNavigation={hideNavigation}
          >
            {children}
          </OgabasseyLayoutChrome>
        </div>
      </OgabasseyLayoutProviders>
    </>
  );
}
