import { Skeleton } from '@/components/ui/skeleton';
import {
  ProductDetailSkeleton,
  ProductGridSkeleton,
  StorefrontHeaderSkeleton,
  StorefrontPageSkeleton,
} from '@/components/ui/skeletons';
import { BlogPostPageFallback } from './blog/[postSlug]/BlogPostPageFallback';
import { BlogListingFallback } from './blog/BlogListingFallback';

type StorefrontFallbackKind =
  | 'home'
  | 'blog-listing'
  | 'blog-post'
  | 'product-listing'
  | 'product-detail'
  | 'generic';

const NON_CATALOG_ROUTE_SEGMENTS = new Set([
  'about',
  'account',
  'cart',
  'checkout',
  'contact',
  'faq',
  'privacy',
  'privacy-policy',
  'receipts',
  'repairs',
  'terms',
  'terms-of-service',
  'track-order',
  'wallet',
  'wishlist',
]);

function normalizeStorefrontPath(
  pathname?: string | null,
  slug?: string | null
) {
  const rawPath = pathname?.split('?')[0]?.split('#')[0]?.trim() || '/';
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  if (!slug) {
    return normalizedPath || '/';
  }

  const slugPrefix = `/${encodeURIComponent(slug)}`;

  if (normalizedPath === slugPrefix) {
    return '/';
  }

  if (normalizedPath.startsWith(`${slugPrefix}/`)) {
    return normalizedPath.slice(slugPrefix.length) || '/';
  }

  return normalizedPath;
}

function resolveStorefrontFallbackKind(
  pathname?: string | null,
  slug?: string | null
): StorefrontFallbackKind {
  const normalizedPath = normalizeStorefrontPath(pathname, slug);
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return 'home';
  }

  if (segments[0] === 'blog') {
    return segments.length === 1 ? 'blog-listing' : 'blog-post';
  }

  if (segments[0] === 'products') {
    return segments.length === 1 ? 'product-listing' : 'product-detail';
  }

  if (NON_CATALOG_ROUTE_SEGMENTS.has(segments[0])) {
    return 'generic';
  }

  return segments.length === 1 ? 'product-listing' : 'product-detail';
}

function GenericStorefrontShellFallback() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900">
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-32 bg-gray-200" shimmer />
          <Skeleton
            className="hidden h-10 max-w-xl flex-1 bg-gray-200 md:block"
            shimmer
          />
          <Skeleton className="ml-auto h-10 w-24 bg-gray-200" shimmer />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <Skeleton className="h-4 w-28 bg-gray-200" shimmer />
          <Skeleton className="h-10 w-full bg-gray-200" shimmer />
          <Skeleton className="h-4 w-5/6 bg-gray-200" shimmer />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Static fallback cards
              key={index}
              className="overflow-hidden rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm"
            >
              <Skeleton
                className="aspect-[4/3] w-full rounded-[20px] bg-gray-200"
                shimmer
              />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-5 w-3/4 bg-gray-200" shimmer />
                <Skeleton className="h-4 w-full bg-gray-200" shimmer />
                <Skeleton className="h-4 w-2/3 bg-gray-200" shimmer />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function StorefrontListingFallback() {
  return (
    <div className="min-h-screen bg-white">
      <StorefrontHeaderSkeleton />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-4">
          <Skeleton className="h-10 w-56 bg-gray-200" shimmer />
          <Skeleton className="h-4 w-full max-w-2xl bg-gray-200" shimmer />
        </div>
        <ProductGridSkeleton count={8} columns={4} />
      </main>
    </div>
  );
}

function ProductDetailPageFallback() {
  return (
    <div className="min-h-screen bg-white">
      <StorefrontHeaderSkeleton />
      <div className="container mx-auto px-4 py-8">
        <ProductDetailSkeleton />
      </div>
    </div>
  );
}

export function StorefrontLayoutFallback({
  pathname,
  slug,
}: {
  pathname?: string | null;
  slug?: string | null;
}) {
  const fallbackKind = resolveStorefrontFallbackKind(pathname, slug);

  if (fallbackKind === 'blog-listing') {
    return <BlogListingFallback />;
  }

  if (fallbackKind === 'blog-post') {
    return (
      <div aria-label="Loading blog post" aria-live="polite" role="status">
        <BlogPostPageFallback />
      </div>
    );
  }

  if (fallbackKind === 'home') {
    return (
      <div
        aria-label="Loading storefront homepage"
        aria-live="polite"
        role="status"
      >
        <StorefrontPageSkeleton />
      </div>
    );
  }

  if (fallbackKind === 'product-listing') {
    return (
      <div
        aria-label="Loading product listing"
        aria-live="polite"
        role="status"
      >
        <StorefrontListingFallback />
      </div>
    );
  }

  if (fallbackKind === 'product-detail') {
    return (
      <div aria-label="Loading product page" aria-live="polite" role="status">
        <ProductDetailPageFallback />
      </div>
    );
  }

  return (
    <div aria-label="Loading store" aria-live="polite" role="status">
      <GenericStorefrontShellFallback />
    </div>
  );
}
