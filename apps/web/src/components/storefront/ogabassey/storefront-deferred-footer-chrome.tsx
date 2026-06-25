'use client';

import type { MerchantData } from '@/hooks/merchant/types';
import { AdUnit } from './components/AdUnit';
import { DeferredChatWidget } from './components/chat/DeferredChatWidget';
import { DeferredCartSidebar } from './components/deferred-cart-sidebar';
import { Footer } from './components/Footer';

interface StorefrontDeferredFooterChromeProps {
  basePath: string;
  merchant?: MerchantData;
}

export function StorefrontDeferredFooterChrome({
  basePath,
  merchant,
}: StorefrontDeferredFooterChromeProps) {
  return (
    <>
      <Footer merchant={merchant} storeSlug={basePath} />

      {/* Intrinsic size mirrors the max-width storefront grid and reserves the 970x250 desktop footer banner while content-visibility skips the offscreen footer work. */}
      <div className="flex min-h-[100px] justify-center border-store-border border-t bg-store-background py-4 content-auto md:min-h-[250px] [contain-intrinsic-size:1400px_250px]">
        <AdUnit placementKey="FOOTER_BANNER" />
      </div>

      <DeferredCartSidebar />
      <DeferredChatWidget />
    </>
  );
}
