import { Skeleton } from '@/components/ui/skeleton';

export default function BlogPostEditLoading() {
  return (
    <div
      aria-busy="true"
      className="min-h-[calc(100vh-8rem)] space-y-6 bg-background text-foreground"
    >
      <div
        aria-label="Loading blog post editor"
        className="sr-only"
        role="status"
      >
        Loading blog post editor
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Skeleton className="h-10 w-full sm:w-28" />
          <Skeleton className="h-10 w-full sm:w-32" />
          <Skeleton className="h-10 w-full sm:w-28" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>
      </div>

      <div className="flex w-fit rounded-md border bg-card p-1">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="ml-1 h-9 w-16" />
        <Skeleton className="ml-1 h-9 w-20" />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="space-y-2 border-b p-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="overflow-hidden rounded-md border bg-card">
              <div className="flex flex-wrap gap-3 border-b p-4">
                {['format', 'bold', 'italic', 'link', 'image', 'list'].map(
                  (control) => (
                    <Skeleton
                      className="h-8 w-8 rounded-md"
                      key={`editor-loading-${control}`}
                    />
                  )
                )}
              </div>
              <div className="space-y-4 p-6">
                <Skeleton className="h-5 w-11/12" />
                <Skeleton className="h-5 w-10/12" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
