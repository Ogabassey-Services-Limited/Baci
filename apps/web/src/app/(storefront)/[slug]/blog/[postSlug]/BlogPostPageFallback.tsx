import { BlogPostBodyFallback } from './BlogPostBodyFallback';

export function BlogPostPageFallback() {
  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb skeleton */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="h-4 w-28 rounded bg-muted/40" />
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <article className="max-w-6xl mx-auto bg-white rounded-3xl p-6 md:p-10 md:px-12 shadow-sm border border-gray-100 overflow-hidden">
          {/* Featured image skeleton */}
          <div className="aspect-video rounded-2xl mb-8 bg-muted/30 animate-pulse" />

          {/* Header skeleton: category + title + author row */}
          <div className="space-y-4 mb-8">
            <div className="h-5 w-20 rounded-full bg-muted/40" />
            <div className="h-8 w-3/4 rounded bg-muted/50" />
            <div className="h-8 w-1/2 rounded bg-muted/40" />
            <div className="flex items-center gap-3 pt-2">
              <div className="h-10 w-10 rounded-full bg-muted/40" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-muted/40" />
                <div className="h-3 w-32 rounded bg-muted/30" />
              </div>
            </div>
          </div>

          {/* Body skeleton */}
          <BlogPostBodyFallback />
        </article>
      </main>
    </div>
  );
}
