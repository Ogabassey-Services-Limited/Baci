'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { DeferredDetailsSkeleton } from '@/components/storefront/ogabassey/pages/product-details-page/deferred-details-skeleton';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import type { OgabasseyPdpDeferredTabProduct } from './deferred-product-payload';

/**
 * The below-fold product tabs are loaded with a RUNTIME `import()` inside
 * the activation effect rather than a top-level `next/dynamic`. A static
 * `dynamic(() => import('...product-details-page'))` is statically discovered
 * by Next, which injects a `<link rel="preload" as="style">` for the page's
 * deferred CSS chunk (`storefront-ogabassey-pdp-deferred.css`) into the initial
 * document head. Because this island is viewport-gated, that stylesheet is
 * preloaded but never evaluated on load — Lighthouse flags it as an unused
 * preload and it competes for mobile bandwidth on the critical path. Loading
 * the chunk only once `isActive` keeps Next from discovering (and preheading)
 * it, deferring the CSS entirely until the details are actually needed.
 */
type DeferredTabsComponent =
  (typeof import('./deferred-tabs.client'))['OgabasseyPdpDeferredTabsClient'];

type DeferredTabsLoader = () => Promise<{
  OgabasseyPdpDeferredTabsClient: DeferredTabsComponent;
}>;

function loadDeferredTabs() {
  return import('./deferred-tabs.client');
}

interface OgabasseyPdpDeferredDetailClientProps {
  descriptionSlot?: ReactNode;
  productData: OgabasseyPdpDeferredTabProduct;
  loadDetailsComponent?: DeferredTabsLoader;
  storeSlug: string;
}

export function OgabasseyPdpDeferredDetailClient({
  descriptionSlot,
  productData,
  loadDetailsComponent = loadDeferredTabs,
  storeSlug,
}: OgabasseyPdpDeferredDetailClientProps) {
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '400px 0px',
    timeoutMs: 1600,
  });
  const [DetailComponent, setDetailComponent] =
    useState<DeferredTabsComponent | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    if (!isActive || DetailComponent) {
      return;
    }
    let cancelled = false;
    setHasLoadError(false);
    void loadDetailsComponent()
      .then((mod) => {
        if (!cancelled) {
          setDetailComponent(() => mod.OgabasseyPdpDeferredTabsClient);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, DetailComponent, loadDetailsComponent]);

  return (
    <div ref={ref} data-ogabassey-pdp-deferred-detail-client>
      {isActive && DetailComponent ? (
        <DetailComponent
          descriptionSlot={descriptionSlot}
          productData={productData}
          storeSlug={storeSlug}
        />
      ) : (
        <>
          {descriptionSlot ? (
            <div data-ogabassey-pdp-deferred-description-container>
              <div data-ogabassey-pdp-deferred-description-panel>
                {descriptionSlot}
                {hasLoadError ? (
                  <div
                    data-ogabassey-pdp-deferred-description-error
                    role="alert"
                  >
                    Product details could not be loaded. Refresh to try again.
                  </div>
                ) : null}
              </div>
            </div>
          ) : hasLoadError ? (
            <div
              data-ogabassey-pdp-deferred-description-error
              role="alert"
            >
              Product details could not be loaded. Refresh to try again.
            </div>
          ) : null}
          {hasLoadError ? null : <DeferredDetailsSkeleton />}
        </>
      )}
    </div>
  );
}
