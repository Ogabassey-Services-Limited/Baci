'use client';

import { lazy, Suspense } from 'react';
import type { MerchantData } from '@/hooks/merchant/types';
import { AdUnit } from './components/AdUnit';
import { DeferredCartSidebar } from './components/deferred-cart-sidebar';
import { DeferredChatWidget } from './components/chat/DeferredChatWidget';

const DeferredFooter = lazy(async () => {
  const module = await import('./components/Footer');
  return { default: module.Footer };
});

interface StorefrontDeferredFooterChromeProps {
  merchant?: MerchantData;
  basePath: string;
}

export function StorefrontDeferredFooterChrome({
  merchant,
  basePath,
}: StorefrontDeferredFooterChromeProps) {
  return (
    <>
      {/* Intrinsic size mirrors the max-width storefront grid and reserves one 120px banner row while content-visibility skips the offscreen footer work. */}
      <div className="flex justify-center bg-gray-50 border-t border-gray-100/50 py-4 min-h-[120px] content-auto [contain-intrinsic-size:1400px_120px]">
        <AdUnit placementKey="FOOTER_BANNER" />
      </div>

      <div className="content-auto [contain-intrinsic-size:1400px_480px]">
        <Suspense fallback={null}>
          <DeferredFooter merchant={merchant} storeSlug={basePath} />
        </Suspense>
      </div>

      <DeferredCartSidebar />
      <DeferredChatWidget />
    </>
  );
}
