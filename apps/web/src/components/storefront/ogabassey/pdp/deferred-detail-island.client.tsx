'use client';

import dynamic from 'next/dynamic';
import type { Product } from '@/components/storefront/ogabassey/types';
import { DeferredDetailsSkeleton } from '@/components/storefront/ogabassey/pages/product-details-page/deferred-details-skeleton';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';

const ProductDetailsPage = dynamic(
  () =>
    import('@/components/storefront/ogabassey/pages/product-details-page').then(
      (mod) => mod.ProductDetailsPage
    ),
  {
    loading: () => <DeferredDetailsSkeleton />,
    ssr: false,
  }
);

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

  return (
    <div ref={ref} data-ogabassey-pdp-deferred-detail-client>
      {isActive ? (
        <ProductDetailsPage mode="belowFold" product={product} />
      ) : (
        <DeferredDetailsSkeleton />
      )}
    </div>
  );
}
