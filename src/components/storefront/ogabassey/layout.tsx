'use client';

import type React from 'react';
import { CartProvider } from '@/hooks/use-cart';

import { ChatWidget } from './components/ChatWidget';
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

export function OgabasseyLayout({ children }: { children: React.ReactNode }) {
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
                  storeName="Ogabassey"
                  storeSlug="ogabassey"
                  showSearch={true}
                  showCart={true}
                  showUser={true}
                  showBell={true}
                />
                <main className="flex-1">{children}</main>
                <Footer />
                <MobileFooter />
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
