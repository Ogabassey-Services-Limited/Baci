'use client';

import { useEffect, useState } from 'react';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import type { Product } from '@/lib/products';

/**
 * The related-product rails are loaded with a runtime `import()` inside the
 * activation effect (same approach as the deferred detail island) so their
 * JS/CSS chunk is never statically discovered by Next and preloaded onto the
 * critical path. The chunk is fetched only once the rails scroll into view.
 */
type DeferredProductRailsComponent =
  (typeof import('@/components/storefront/ogabassey/pages/product-details-page/deferred-product-rails'))['DeferredProductRails'];

type DeferredProductRailsLoader = () => Promise<{
  DeferredProductRails: DeferredProductRailsComponent;
}>;

function loadProductRails() {
  return import(
    '@/components/storefront/ogabassey/pages/product-details-page/deferred-product-rails'
  );
}

interface OgabasseyPdpDeferredRailsIslandProps {
  product: Product;
  loadRailsComponent?: DeferredProductRailsLoader;
}

export function OgabasseyPdpDeferredRailsIsland({
  product,
  loadRailsComponent = loadProductRails,
}: OgabasseyPdpDeferredRailsIslandProps) {
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '400px 0px',
    timeoutMs: 0,
  });
  const [RailsComponent, setRailsComponent] =
    useState<DeferredProductRailsComponent | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    if (!isActive || RailsComponent) {
      return;
    }
    let cancelled = false;
    setHasLoadError(false);
    void loadRailsComponent()
      .then((mod) => {
        if (!cancelled) {
          setRailsComponent(() => mod.DeferredProductRails);
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
  }, [isActive, RailsComponent, loadRailsComponent]);

  return (
    <div ref={ref} data-ogabassey-pdp-deferred-rails>
      {hasLoadError || !(isActive && RailsComponent) ? null : (
        <RailsComponent product={product} />
      )}
    </div>
  );
}
