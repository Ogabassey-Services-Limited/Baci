'use client';

import { type MerchantData, useMerchantSafe } from '@/hooks/use-merchant';
import type React from 'react';
import { CartProvider } from '@/hooks/use-cart';

import { ChatWidget } from './components/ChatWidget';
import { CartSidebar } from './components/CartSidebar';
import { Footer } from './components/Footer';
import { MobileFooter } from './components/MobileFooter';
import { OfflineNotice } from './components/OfflineNotice';
import { PopupSystem } from './components/PopupSystem';
import { SnowEffect } from './components/SnowEffect';
import { OgabasseyNavbar as Navbar } from './layout/navbar';
import { V2ComparisonProvider } from './providers/v2-comparison-context';
import { V2NotificationProvider } from './providers/v2-notification-context';
import { V2SavedProvider } from './providers/v2-saved-context';
import { type V2ThemeMode, V2ThemeProvider } from './providers/v2-theme-context';


export function OgabasseyLayout({
  children,
  merchant,
  initialTheme,
  isCheckout = false,
}: {
  children: React.ReactNode;
  merchant?: MerchantData;
  /** Initial theme from server cookie - enables SSR consistency */
  initialTheme?: V2ThemeMode;
  /** Whether we're on the checkout page - passed from server to avoid hydration issues */
  isCheckout?: boolean;
}) {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || `/${merchant?.slug || 'ogabassey'}`;

  return (
    <V2ThemeProvider initialTheme={initialTheme}>
      {/* Using unified cart with Smart Cart Pro enabled */}
      <CartProvider enableSmartCartPro={true}>
        <V2SavedProvider>
          <V2ComparisonProvider>
            <V2NotificationProvider>
              <div className="text-gray-900 bg-white min-h-screen flex flex-col">
                <SnowEffect />
                {!isCheckout && (
                  <Navbar
                    storeName={merchant?.business_name || 'Ogabassey'}
                    storeSlug={basePath}
                    showSearch={true}
                    showCart={true}
                    showUser={true}
                    showBell={true}
                  />
                )}

                <main className="flex-1">{children}</main>

                {!isCheckout && (
                  <>
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
      </CartProvider>
    </V2ThemeProvider>
  );
}
