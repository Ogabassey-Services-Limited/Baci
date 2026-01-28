'use client';

import { type MerchantData, useMerchantSafe } from '@/hooks/use-merchant';
import type React from 'react';
import { Suspense } from 'react';
import { CartProvider } from '@/hooks/use-cart';

import { ChatWidget } from './components/ChatWidget';
import { CartSidebar } from './components/CartSidebar';
import { Footer } from './components/Footer';
import { MobileFooter } from './components/MobileFooter';
import { OfflineNotice } from './components/OfflineNotice';
import { PopupSystem } from './components/PopupSystem';
import { GadgetPattern } from './components/GadgetPattern';
import { OgabasseyNavbar as Navbar } from './layout/navbar';
import { V2ComparisonProvider } from './providers/v2-comparison-context';
import { V2NotificationProvider } from './providers/v2-notification-context';
import { V2SavedProvider } from './providers/v2-saved-context';
import { type V2ThemeMode, V2ThemeProvider } from './providers/v2-theme-context';
import { GoogleAdManager } from './components/GoogleAdManager';
import { AdUnit } from './components/AdUnit';


import { usePathname } from 'next/navigation';
import { hexToHslComponents, getContrastingTextColor } from '@/lib/color-utils';

export function OgabasseyLayout({
  children,
  merchant,
  initialTheme,
  hideNavigation: initialHideNavigation = false,
}: {
  children: React.ReactNode;
  merchant?: MerchantData;
  /** Initial theme from server cookie - enables SSR consistency */
  initialTheme?: V2ThemeMode;
  /** Whether to hide navigation (header/footer) - e.g. for checkout or auth pages */
  hideNavigation?: boolean;
}) {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath ?? `/${merchant?.slug || 'ogabassey'}`;
  const pathname = usePathname();

  // Dynamic check for client-side navigation (fixes persistent layout causing stale props)
  const isCheckout = pathname?.includes('/checkout');
  const isAuthPage =
    pathname?.includes('/account/login') ||
    pathname?.includes('/track-order') ||
    pathname?.includes('/auth/');

  const shouldHideNavigation = initialHideNavigation || isCheckout || isAuthPage;

  // No debug logging in production

  return (
    <V2ThemeProvider initialTheme={initialTheme}>
      {/* Using unified cart with Smart Cart Pro enabled */}
      <V2SavedProvider>
        <V2ComparisonProvider>
          <V2NotificationProvider>
            <GoogleAdManager />
            <div
              className="text-gray-900 bg-[#0F0F0F] min-h-screen flex flex-col relative overflow-hidden"
              style={{
                // Core shadcn/ui variables to prevent "blue flash" and ensure branding
                '--primary': merchant?.brand_colors?.primary
                  ? hexToHslComponents(merchant.brand_colors.primary)
                  : undefined,
                '--primary-foreground': merchant?.brand_colors?.primary
                  ? hexToHslComponents(getContrastingTextColor(merchant.brand_colors.primary))
                  : undefined,
                '--accent': merchant?.brand_colors?.accent
                  ? hexToHslComponents(merchant.brand_colors.accent)
                  : undefined,
                '--accent-foreground': merchant?.brand_colors?.accent
                  ? hexToHslComponents(getContrastingTextColor(merchant.brand_colors.accent))
                  : undefined,
                '--ring': merchant?.brand_colors?.primary
                  ? hexToHslComponents(merchant.brand_colors.primary)
                  : undefined,
                // Legacy store variables
                '--store-primary': merchant?.brand_colors?.primary || '#d62027',
                '--store-accent': merchant?.brand_colors?.accent || '#d62027',
              } as React.CSSProperties}
            >
              <GadgetPattern />

              {!shouldHideNavigation && (
                <Suspense fallback={<div className="h-16 bg-[#0F0F0F]" />}>
                  <Navbar
                    storeName={merchant?.business_name || 'Ogabassey'}
                    storeSlug={basePath}
                    showSearch={true}
                    showCart={true}
                    showUser={true}
                    showBell={true}
                  />
                </Suspense>
              )}



              <main id="main-content" className="flex-1">{children}</main>

              {!shouldHideNavigation && (
                <>
                  {/* Ad Placement: Footer Banner */}
                  <div className="flex justify-center bg-gray-50 border-t border-gray-100/50 py-4 min-h-[120px]">
                    <AdUnit placementKey="FOOTER_BANNER" />
                  </div>

                  <Footer merchant={merchant} storeSlug={basePath} />
                  <MobileFooter storeSlug={basePath} />
                  <CartSidebar />
                  <ChatWidget />
                </>
              )}

              <PopupSystem />
              <OfflineNotice />
            </div>
          </V2NotificationProvider>
        </V2ComparisonProvider>
      </V2SavedProvider>
    </V2ThemeProvider>
  );
}
