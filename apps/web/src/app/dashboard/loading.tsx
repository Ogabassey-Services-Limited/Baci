import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-y-2">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-x-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {['revenue', 'orders', 'customers', 'products'].map((metric) => (
          <div
            key={`metric-skeleton-${metric}`}
            className="rounded-xl border bg-card text-card-foreground shadow-sm p-6"
          >
            <div className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-4 rounded-full" />
            </div>
            <div className="gap-y-2 mt-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Main Chart */}
        <div className="col-span-4 rounded-xl border bg-card shadow-sm">
          <div className="p-6 pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48 mt-1" />
          </div>
          <div className="p-6 pt-0">
            <Skeleton className="h-[350px] w-full mt-4" />
          </div>
        </div>

        {/* Recent Sales */}
        <div className="col-span-3 rounded-xl border bg-card shadow-sm">
          <div className="p-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-40 mt-1" />
          </div>
          <div className="p-6 pt-0 space-y-6">
            {['sale-1', 'sale-2', 'sale-3', 'sale-4', 'sale-5'].map(
              (saleId) => (
                <div
                  key={`sale-skeleton-${saleId}`}
                  className="flex items-center"
                >
                  <Skeleton className="size-9 rounded-full" />
                  <div className="ml-4 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="ml-auto">
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
