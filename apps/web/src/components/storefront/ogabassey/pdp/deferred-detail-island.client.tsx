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

interface OgabasseyPdpDeferredDetailClientProps {
  product: Product;
}

export function OgabasseyPdpDeferredDetailClient({
  product,
}: OgabasseyPdpDeferredDetailClientProps) {
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '400px 0px',
    timeoutMs: 1600,
  });
  const [DetailComponent, setDetailComponent] =
    useState<ProductDetailsPageComponent | null>(null);

  useEffect(() => {
    if (!isActive || DetailComponent) {
      return;
    }
    let cancelled = false;
    void import(
      '@/components/storefront/ogabassey/pages/product-details-page'
    ).then((mod) => {
      if (!cancelled) {
        setDetailComponent(() => mod.ProductDetailsPage);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isActive, DetailComponent]);

  return (
    <div ref={ref} data-ogabassey-pdp-deferred-detail-client>
      {isActive && DetailComponent ? (
        <DetailComponent mode="belowFold" product={product} />
      ) : (
        <DeferredDetailsSkeleton />
      )}
    </div>
  );
}
