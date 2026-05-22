'use client';

import dynamic from 'next/dynamic';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import { DeferredDetailsSkeleton } from './deferred-details-skeleton';
import type { DeferredProductDetailsSectionsProps } from './deferred-product-details-sections';

export interface DeferredProductDetailsSectionsLoaderProps
  extends DeferredProductDetailsSectionsProps {}

const DeferredProductDetailsSections = dynamic(
  () =>
    import('./deferred-product-details-sections').then(
      (mod) => mod.DeferredProductDetailsSections
    ),
  {
    loading: () => <DeferredDetailsSkeleton />,
    ssr: false,
  }
);

export function DeferredProductDetailsSectionsLoader(
  props: DeferredProductDetailsSectionsLoaderProps
) {
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '200px 0px',
    timeoutMs: 0,
  });

  return (
    <div ref={ref}>
      {isActive ? (
        <DeferredProductDetailsSections {...props} />
      ) : (
        <DeferredDetailsSkeleton />
      )}
    </div>
  );
}
