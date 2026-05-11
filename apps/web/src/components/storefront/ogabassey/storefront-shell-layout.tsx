import type React from 'react';
import type { MerchantData } from '@/hooks/merchant/types';
import { GadgetPattern } from './components/GadgetPattern';
import type { V2ThemeMode } from './providers/v2-theme-context';
import { OgabasseyLayoutProviders } from './storefront-layout-providers';
import { getOgabasseyLayoutStyle } from './storefront-layout-utils';

interface StorefrontShellLayoutProps {
  children: React.ReactNode;
  merchant?: MerchantData;
  initialTheme?: V2ThemeMode;
  headerChrome?: React.ReactNode;
  footerChrome?: React.ReactNode;
  overlayChrome?: React.ReactNode;
}

export function StorefrontShellLayout({
  children,
  merchant,
  initialTheme,
  headerChrome,
  footerChrome,
  overlayChrome,
}: StorefrontShellLayoutProps) {
  return (
    <OgabasseyLayoutProviders initialTheme={initialTheme}>
      <div
        className="text-gray-900 bg-[#0F0F0F] min-h-screen flex flex-col relative overflow-hidden"
        style={getOgabasseyLayoutStyle(merchant)}
      >
        <GadgetPattern />
        {headerChrome}
        <main id="main-content" className="flex-1">
          {children}
        </main>
        {footerChrome}
        {overlayChrome}
      </div>
    </OgabasseyLayoutProviders>
  );
}
