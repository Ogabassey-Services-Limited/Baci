'use client';

import { useEffect, useState } from 'react';
import { DeferredDetailsSkeleton } from '@/components/storefront/ogabassey/pages/product-details-page/deferred-details-skeleton';
import type { Product } from '@/components/storefront/ogabassey/types';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';

/**
 * The below-fold product details are loaded with a RUNTIME `import()` inside
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
type ProductDetailsPageComponent =
  (typeof import('@/components/storefront/ogabassey/pages/product-details-page'))['ProductDetailsPage'];

type ProductDetailsPageLoader = () => Promise<{
  ProductDetailsPage: ProductDetailsPageComponent;
}>;

function loadProductDetailsPage() {
  return import('@/components/storefront/ogabassey/pages/product-details-page');
}

interface OgabasseyPdpDeferredDetailClientProps {
  product: Product;
  loadDetailsComponent?: ProductDetailsPageLoader;
}

export function OgabasseyPdpDeferredDetailClient({
  product,
  loadDetailsComponent = loadProductDetailsPage,
}: OgabasseyPdpDeferredDetailClientProps) {
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '400px 0px',
    timeoutMs: 1600,
  });
  const [DetailComponent, setDetailComponent] =
    useState<ProductDetailsPageComponent | null>(null);
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
          setDetailComponent(() => mod.ProductDetailsPage);
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
      {hasLoadError ? (
        <div
          className="rounded-2xl border border-store-border bg-store-card p-4 text-sm text-store-background-text"
          role="alert"
        >
          Product details could not be loaded. Refresh to try again.
        </div>
      ) : isActive && DetailComponent ? (
        <DetailComponent mode="belowFold" product={product} />
      ) : (
        <DeferredDetailsSkeleton />
      )}
    </div>
  );
}
