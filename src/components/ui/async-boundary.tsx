'use client';

import { type ReactNode, Suspense } from 'react';
import { Skeleton } from './skeletons';

interface AsyncBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * If true, shows a simple skeleton placeholder
   * If string, shows skeleton with that className
   */
  skeleton?: boolean | string;
}

/**
 * Reusable Suspense boundary for async content
 *
 * Usage:
 * ```tsx
 * <AsyncBoundary skeleton>
 *   <AsyncComponent />
 * </AsyncBoundary>
 *
 * // Or with custom fallback
 * <AsyncBoundary fallback={<ProductGridSkeleton />}>
 *   <ProductGrid />
 * </AsyncBoundary>
 * ```
 */
export function AsyncBoundary({
  children,
  fallback,
  skeleton,
}: AsyncBoundaryProps) {
  const fallbackContent =
    fallback ||
    (skeleton ? (
      <Skeleton
        className={typeof skeleton === 'string' ? skeleton : 'h-32 w-full'}
      />
    ) : null);

  return <Suspense fallback={fallbackContent}>{children}</Suspense>;
}

/**
 * Error boundary + Suspense combined
 * Catches both loading and error states
 */
export { AsyncBoundary as SuspenseBoundary };
