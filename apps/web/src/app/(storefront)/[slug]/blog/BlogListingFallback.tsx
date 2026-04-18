import { Skeleton } from '@/components/ui/skeleton';

export function BlogListingFallback() {
  return (
    <div
      aria-label="Loading blog posts"
      aria-live="polite"
      className="min-h-screen bg-[#fafafa] pb-20 pt-4"
      role="status"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-8 md:pt-12">
        <div className="mb-12 overflow-hidden rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <Skeleton
            className="h-[320px] w-full rounded-[1.5rem] bg-gray-200 md:h-[420px]"
            shimmer
          />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-4 w-28 bg-gray-200" shimmer />
            <Skeleton className="h-10 w-full max-w-3xl bg-gray-200" shimmer />
            <Skeleton className="h-5 w-full max-w-2xl bg-gray-200" shimmer />
          </div>
        </div>

        <div className="mb-10 flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: Static fallback pills
              key={index}
              className="h-10 w-28 shrink-0 rounded-full bg-gray-200"
              shimmer
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Static fallback cards
              key={index}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <Skeleton
                className="h-64 w-full rounded-[1.25rem] bg-gray-200"
                shimmer
              />
              <div className="mt-5 space-y-3">
                <Skeleton className="h-3 w-1/2 bg-gray-200" shimmer />
                <Skeleton className="h-7 w-full bg-gray-200" shimmer />
                <Skeleton className="h-7 w-4/5 bg-gray-200" shimmer />
                <Skeleton className="h-4 w-full bg-gray-200" shimmer />
                <Skeleton className="h-4 w-2/3 bg-gray-200" shimmer />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
