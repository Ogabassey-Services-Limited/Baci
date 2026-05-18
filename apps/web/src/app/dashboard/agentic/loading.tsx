import { Skeleton } from '@/components/ui/skeleton';

export default function AgenticDashboardLoading() {
  return (
    <div
      aria-label="Loading agentic commerce centers"
      aria-live="polite"
      className="space-y-6 p-3 pb-24 md:p-6 md:pb-8"
      role="status"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4 rounded-lg border border-border/70 p-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </div>
  );
}
