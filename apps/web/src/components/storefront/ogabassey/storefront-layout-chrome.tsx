'use client';

import { usePathname } from 'next/navigation';
import { lazy, Suspense } from 'react';
import type { MerchantData } from '@/hooks/merchant/types';
import { DeferredShellFeature } from './components/deferred-shell-feature';
import { GoogleAdManager } from './components/GoogleAdManager';
import { MobileFooter } from './components/MobileFooter';
import { OgabasseyNavbar as Navbar } from './layout/navbar';
import {
  type OgabasseyChromeSection,
  shouldHideOgabasseyMobileFooter,
  shouldHideOgabasseyNavigation,
} from './storefront-layout-utils';

const StorefrontDeferredFooterChrome = lazy(async () => {
  const module = await import('./storefront-deferred-footer-chrome');
  return { default: module.StorefrontDeferredFooterChrome };
});

const StorefrontDeferredOverlayChrome = lazy(async () => {
  const module = await import('./storefront-deferred-overlay-chrome');
  return { default: module.StorefrontDeferredOverlayChrome };
});

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
  const resolvedHideMobileFooter = shouldHideOgabasseyMobileFooter(
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
        {!resolvedHideMobileFooter && <MobileFooter storeSlug={basePath} />}

        <DeferredShellFeature
          timeoutMs={1600}
          activateOnInteraction
          deferInteractionActivationUntilNextPaint
        >
          <Suspense fallback={null}>
            <StorefrontDeferredFooterChrome
              basePath={basePath}
              merchant={merchant}
            />
          </Suspense>
        </DeferredShellFeature>
      </>
    );
  }

  return (
    <DeferredShellFeature
      timeoutMs={2200}
      activateOnInteraction
      deferInteractionActivationUntilNextPaint
    >
      <Suspense fallback={null}>
        <StorefrontDeferredOverlayChrome />
      </Suspense>
    </DeferredShellFeature>
  );
}
