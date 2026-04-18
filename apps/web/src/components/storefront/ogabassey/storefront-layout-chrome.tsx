'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type React from 'react';
import type { MerchantData } from '@/hooks/use-merchant';
import { AdUnit } from './components/AdUnit';
import { DeferredShellFeature } from './components/deferred-shell-feature';
import { GoogleAdManager } from './components/GoogleAdManager';
import { MobileFooter } from './components/MobileFooter';
import { DeferredChatWidget } from './components/chat/DeferredChatWidget';
import { OgabasseyNavbar as Navbar } from './layout/navbar';
import { shouldHideOgabasseyNavigation } from './storefront-layout-utils';

const DeferredCartSidebar = dynamic(
  () => import('./components/CartSidebar').then((mod) => mod.CartSidebar),
  { ssr: false }
);
const DeferredFooter = dynamic(
  () => import('./components/Footer').then((mod) => mod.Footer),
  { ssr: false }
);
const DeferredPopupSystem = dynamic(
  () => import('./components/PopupSystem').then((mod) => mod.PopupSystem),
  { ssr: false }
);
const DeferredOfflineNotice = dynamic(
  () => import('./components/OfflineNotice').then((mod) => mod.OfflineNotice),
  { ssr: false }
);

interface OgabasseyLayoutChromeProps {
  children: React.ReactNode;
  merchant?: MerchantData;
  basePath: string;
  hideNavigation?: boolean;
}

export function OgabasseyLayoutChrome({
  children,
  merchant,
  basePath,
  hideNavigation: initialHideNavigation = false,
}: OgabasseyLayoutChromeProps) {
  const pathname = usePathname();
  const shouldHideNavigation = shouldHideOgabasseyNavigation(
    pathname,
    initialHideNavigation
  );

  return (
    <>
      <GoogleAdManager />

      {!shouldHideNavigation && <Navbar storeSlug={basePath} />}

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {!shouldHideNavigation && (
        <>
          <DeferredShellFeature
            timeoutMs={1600}
            activateOnInteraction={false}
          >
            <div className="flex justify-center bg-gray-50 border-t border-gray-100/50 py-4 min-h-[120px] [content-visibility:auto] [contain-intrinsic-size:1400px_120px]">
              <AdUnit placementKey="FOOTER_BANNER" />
            </div>
          </DeferredShellFeature>

          <DeferredShellFeature
            timeoutMs={1400}
            activateOnInteraction={false}
          >
            <div className="[content-visibility:auto] [contain-intrinsic-size:1400px_480px]">
              <DeferredFooter merchant={merchant} storeSlug={basePath} />
            </div>
          </DeferredShellFeature>
          <MobileFooter storeSlug={basePath} />
          <DeferredShellFeature timeoutMs={1200}>
            <DeferredCartSidebar />
          </DeferredShellFeature>
          <DeferredChatWidget />
        </>
      )}

      <DeferredShellFeature
        timeoutMs={0}
        activateOnIdle={false}
      >
        <DeferredPopupSystem />
      </DeferredShellFeature>
      <DeferredShellFeature
        timeoutMs={1000}
        activateOnInteraction={false}
      >
        <DeferredOfflineNotice />
      </DeferredShellFeature>
    </>
  );
}
