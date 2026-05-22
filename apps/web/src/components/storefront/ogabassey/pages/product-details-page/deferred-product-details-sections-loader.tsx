'use client';

import dynamic from 'next/dynamic';
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
  }
);

export function DeferredProductDetailsSectionsLoader(
  props: DeferredProductDetailsSectionsLoaderProps
) {
  return <DeferredProductDetailsSections {...props} />;
}
