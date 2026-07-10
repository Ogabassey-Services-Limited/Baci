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

function normalizeFooterBasePath(basePath: string): string {
  const normalized = basePath.trim().replace(/\/+$/g, '');
  return normalized === '/' ? '' : normalized;
}

function buildFooterHref(basePath: string, path: string): string {
  const normalizedBasePath = normalizeFooterBasePath(basePath);
  return `${normalizedBasePath}${path}`;
}

function StorefrontSemanticFooterFallback({ basePath }: { basePath: string }) {
  const links = [
    ['About Us', '/about'],
    ['All Products', '/products'],
    ['Blog', '/blog'],
    ['Track Order', '/track-order'],
    ['Contact Us', '/contact'],
    ['FAQ', '/faq'],
    ['Terms of Service', '/terms'],
    ['Privacy Policy', '/privacy'],
  ] as const;

  return (
    <footer
      aria-label="Semantic storefront footer"
      // Reserve the real Ogabassey footer's stacked height per breakpoint so the
      // deferred fallback -> full subtree swap (footer + FOOTER_BANNER wrapper)
      // has no height delta. Without this, the short link-list fallback was
      // replaced by the stacked footer and ad wrapper once deferred chrome
      // activated, shifting the footer pattern and content below it.
      className="min-h-[1100px] border-store-border border-t bg-store-background px-4 py-8 text-store-background-text md:min-h-[910px] lg:min-h-[770px]"
    >
      <nav
        aria-label="Footer navigation"
        className="mx-auto flex max-w-[1400px] flex-wrap gap-x-6 gap-y-3 text-sm"
      >
        {links.map(([label, path]) => (
          <a
            className="text-store-background-text/75 underline-offset-4 hover:text-store-primary hover:underline"
            href={buildFooterHref(basePath, path)}
            key={path}
          >
            {label}
          </a>
        ))}
      </nav>
    </footer>
  );
}

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
          fallback={<StorefrontSemanticFooterFallback basePath={basePath} />}
          timeoutMs={1600}
          activateOnInteraction
          deferInteractionActivationUntilNextPaint
        >
          <Suspense
            fallback={<StorefrontSemanticFooterFallback basePath={basePath} />}
          >
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
