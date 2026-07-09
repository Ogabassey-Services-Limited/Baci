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

      {/* Intrinsic size mirrors the max-width storefront grid and matches the
          FOOTER_BANNER slot per breakpoint (320x100 mobile, 970x250 desktop) so
          content-visibility never over-reserves. Reserving 250px on mobile —
          where the real ad box is only 100px — made the wrapper shrink 250→100
          the moment it scrolled into view, a recorded layout shift. */}
      <div className="flex min-h-[100px] justify-center border-store-border border-t bg-store-background py-4 content-auto md:min-h-[250px] [contain-intrinsic-size:1400px_100px] md:[contain-intrinsic-size:1400px_250px]">
        <AdUnit placementKey="FOOTER_BANNER" />
      </div>

      <DeferredCartSidebar />
      <DeferredChatWidget />
    </>
  );
}
