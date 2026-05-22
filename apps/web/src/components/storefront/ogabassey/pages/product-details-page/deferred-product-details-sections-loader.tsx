'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { DeferredDetailsSkeleton } from './deferred-details-skeleton';
import type { DeferredProductDetailsSectionsProps } from './deferred-product-details-sections';

interface DeferredProductDetailsSectionsModule {
  DeferredProductDetailsSections: ComponentType<
    DeferredProductDetailsSectionsProps
  >;
}

export interface DeferredProductDetailsSectionsLoaderProps
  extends DeferredProductDetailsSectionsProps {
  loadDeferredSections?: () => Promise<DeferredProductDetailsSectionsModule>;
}

const DeferredProductDetailsSections = dynamic(
  () =>
    import('./deferred-product-details-sections').then(
      (mod) => mod.DeferredProductDetailsSections
    ),
  {
    loading: () => <DeferredDetailsSkeleton />,
  }
);

export function DeferredProductDetailsSectionsLoader({
  loadDeferredSections,
  ...props
}: DeferredProductDetailsSectionsLoaderProps) {
  return <DeferredProductDetailsSections {...props} />;
}
