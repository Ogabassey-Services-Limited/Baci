'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import { DeferredDetailsSkeleton } from './deferred-details-skeleton';
import type { DeferredProductDetailsSectionsProps } from './deferred-product-details-sections';

export type DeferredProductDetailsSectionsLoaderProps = Omit<
  DeferredProductDetailsSectionsProps,
  'onLoaded'
>;

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

  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-busy={!isLoaded}
      aria-label={isLoaded ? 'Product details loaded' : 'Loading product details...'}
      className="w-full"
    >
      {isActive ? (
        <DeferredProductDetailsSections
          {...props}
          onLoaded={() => setIsLoaded(true)}
        />
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

