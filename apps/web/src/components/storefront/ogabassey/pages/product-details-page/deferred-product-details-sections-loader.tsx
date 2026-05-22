'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import type { DeferredProductDetailsSectionsProps } from './deferred-product-details-sections';

interface DeferredProductDetailsSectionsModule {
  DeferredProductDetailsSections: ComponentType<
    DeferredProductDetailsSectionsProps
  >;
}

interface DeferredProductDetailsSectionsLoaderProps
  extends DeferredProductDetailsSectionsProps {
  loadDeferredSections?: () => Promise<DeferredProductDetailsSectionsModule>;
}

const loadDefaultDeferredSections = () =>
  import('./deferred-product-details-sections');

function DeferredDetailsLoadingPlaceholder() {
  return (
    <div
      className="mt-12 min-h-[1200px] [content-visibility:auto] [contain-intrinsic-size:1400px_2200px] w-full"
      data-testid="deferred-product-details-placeholder"
      aria-busy="true"
      aria-label="Loading product details..."
    >
      <div className="animate-pulse space-y-6 px-4">
        <div className="h-10 bg-neutral-200/60 rounded w-1/3" />
        <div className="h-4 bg-neutral-200/60 rounded w-full" />
        <div className="h-4 bg-neutral-200/60 rounded w-5/6" />
        <div className="h-4 bg-neutral-200/60 rounded w-4/5" />
      </div>
    </div>
  );
}

export function DeferredProductDetailsSectionsLoader({
  loadDeferredSections = loadDefaultDeferredSections,
  ...sectionProps
}: DeferredProductDetailsSectionsLoaderProps) {
  const [Sections, setSections] =
    useState<ComponentType<DeferredProductDetailsSectionsProps> | null>(null);
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '200px 0px',
    timeoutMs: 0,
  });

  useEffect(() => {
    if (!isActive || Sections) {
      return;
    }

    let cancelled = false;

    void loadDeferredSections()
      .then((module) => {
        if (!cancelled) {
          setSections(() => module.DeferredProductDetailsSections);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error(
            '[DeferredProductDetailsSectionsLoader] Failed to load product details sections',
            error
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, loadDeferredSections, Sections]);

  return (
    <div ref={ref}>
      {Sections ? (
        <Sections {...sectionProps} />
      ) : (
        <DeferredDetailsLoadingPlaceholder />
      )}
    </div>
  );
}
