interface DeferredDetailsSkeletonProps {
  role?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-busy'?: boolean;
  'aria-label'?: string;
}

export function DeferredDetailsSkeleton({
  role = 'status',
  'aria-live': ariaLive = 'polite',
  'aria-busy': ariaBusy = true,
  'aria-label': ariaLabel = 'Loading product details...',
}: DeferredDetailsSkeletonProps = {}) {
  return (
    <div
      className="mt-12 min-h-[1200px] [content-visibility:auto] [contain-intrinsic-size:1400px_2200px] w-full"
      data-testid="deferred-product-details-placeholder"
      role={role || undefined}
      aria-live={ariaLive || undefined}
      aria-busy={ariaBusy}
      aria-label={ariaLabel || undefined}
    >
      <div className="animate-pulse space-y-6 px-4">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/5" />
      </div>
    </div>
  );
}

