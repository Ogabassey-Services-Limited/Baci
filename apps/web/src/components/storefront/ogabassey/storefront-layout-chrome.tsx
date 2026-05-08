'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { MerchantData } from '@/hooks/use-merchant';
import { AdUnit } from './components/AdUnit';
import { DeferredShellFeature } from './components/deferred-shell-feature';
import { GoogleAdManager } from './components/GoogleAdManager';
import { MobileFooter } from './components/MobileFooter';
import { DeferredChatWidget } from './components/chat/DeferredChatWidget';
import { OgabasseyNavbar as Navbar } from './layout/navbar';
import {
  type OgabasseyChromeSection,
  shouldHideOgabasseyNavigation,
} from './storefront-layout-utils';

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
  merchant?: MerchantData;
  basePath: string;
  /**
   * Force the nav chrome hidden regardless of route. Intended as an
   * escape hatch (e.g. iframe embeds). When `false`/omitted, hide
   * state is derived from the current pathname via `usePathname()`
   * so it stays reactive across client-side route changes — the
   * persistent storefront shell doesn't unmount, so a server-computed
   * value would go stale.
   */
  hideNavigation?: boolean;
  section: OgabasseyChromeSection;
}

export type OgabasseyLayoutChromeSection = OgabasseyChromeSection;

export function OgabasseyLayoutChrome({
  merchant,
  basePath,
  hideNavigation = false,
  section,
}: OgabasseyLayoutChromeProps) {
  const pathname = usePathname();
  const resolvedHideNavigation = shouldHideOgabasseyNavigation(
    pathname,
    hideNavigation
  );

  if (section === 'header') {
    return (
      <>
        <GoogleAdManager />
        {!resolvedHideNavigation && <Navbar storeSlug={basePath} />}
      </>
    );
  }

  if (section === 'footer') {
    if (resolvedHideNavigation) {
      return null;
    }

    return (
      <>
        <DeferredShellFeature
          timeoutMs={1600}
          activateOnInteraction={false}
        >
          <div className="flex justify-center bg-gray-50 border-t border-gray-100/50 py-4 min-h-[120px] content-auto [contain-intrinsic-size:1400px_120px]">
            <AdUnit placementKey="FOOTER_BANNER" />
          </div>
        </DeferredShellFeature>

        <DeferredShellFeature
          timeoutMs={1400}
          activateOnInteraction={false}
        >
          <div className="content-auto [contain-intrinsic-size:1400px_480px]">
            <DeferredFooter merchant={merchant} storeSlug={basePath} />
          </div>
        </DeferredShellFeature>
        <MobileFooter storeSlug={basePath} />
        <DeferredShellFeature timeoutMs={1200}>
          <DeferredCartSidebar />
        </DeferredShellFeature>
        <DeferredChatWidget />
      </>
    );
  }

  return (
    <>
      <DeferredShellFeature timeoutMs={0} activateOnIdle={false}>
        <DeferredPopupSystem />
      </DeferredShellFeature>
      <DeferredShellFeature timeoutMs={1000} activateOnInteraction={false}>
        <DeferredOfflineNotice />
      </DeferredShellFeature>
    </>
  );
}
