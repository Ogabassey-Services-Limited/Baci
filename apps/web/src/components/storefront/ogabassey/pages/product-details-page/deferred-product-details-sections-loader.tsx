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
    loading: () => (
      <DeferredDetailsSkeleton
        role=""
        aria-live="off"
        aria-busy={false}
        aria-label=""
      />
    ),
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
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-busy={!isActive}
      aria-label={isActive ? 'Product details loaded' : 'Loading product details...'}
      className="w-full"
    >
      {isActive ? (
        <DeferredProductDetailsSections {...props} />
      ) : (
        <DeferredDetailsSkeleton
          role=""
          aria-live="off"
          aria-busy={false}
          aria-label=""
        />
      )}
    </div>
  );
}

