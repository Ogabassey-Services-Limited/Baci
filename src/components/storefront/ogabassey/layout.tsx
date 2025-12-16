'use client';

import { type MerchantData, useMerchant } from '@/hooks/use-merchant';
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
import { V2ThemeProvider } from './providers/v2-theme-context';


export function OgabasseyLayout({
  children,
  merchant,
}: {
  children: React.ReactNode;
  merchant?: MerchantData;
}) {
  const { basePath } = useMerchant();
  // Ensure we have a valid slug for display/logic, but use basePath for links
  const defaultSlug = merchant?.slug || 'ogabassey';
  // If basePath is empty, links should be /path. If /slug, links should be /slug/path.
  // The components expect "storeSlug" to be the prefix.
  // However, Navbar and MobileFooter might use storeSlug for OTHER things (like API calls?).
  // Let's verify if storeSlug is ONLY used for links.

  // Actually, Navbar uses storeSlug for `searchUrl` etc?
  // I should check Navbar usage. But for now, assuming passing basePath is correct for routing.
  // BUT basePath has leading slash. storeSlug usually does NOT?
  // Let's check Footer usage in next step. For now, let's prepare the layout.

  return (
    <V2ThemeProvider>
      {/* Using unified cart with Smart Cart Pro enabled */}
      <CartProvider enableSmartCartPro={true}>
        <V2SavedProvider>
          <V2ComparisonProvider>
            <V2NotificationProvider>
              <div className="text-gray-900 bg-white min-h-screen flex flex-col">
                <SnowEffect />
                <Navbar
                  storeName={merchant?.business_name || 'Ogabassey'}
                  storeSlug={basePath}
                  showSearch={true}
                  showCart={true}
                  showUser={true}
                  showBell={true}
                />
                <main className="flex-1">{children}</main>
                <Footer merchant={merchant} storeSlug={basePath} />
                <MobileFooter storeSlug={basePath} />
                <CartSidebar />
                <ChatWidget />
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
