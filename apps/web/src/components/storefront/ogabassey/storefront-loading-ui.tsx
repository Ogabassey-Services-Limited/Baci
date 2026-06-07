import { Skeleton } from '@/components/ui/skeleton';
import type { CSSProperties } from 'react';
import {
  ProductDetailSkeleton,
  ProductGridSkeleton,
  StorefrontHeaderSkeleton,
  StorefrontPageSkeleton,
} from '@/components/ui/skeletons';

interface ShellChromeLoadingMobileHeroImage {
  alt: string;
  avifSrc: string;
  fallbackSrc: string;
}

interface ShellChromeLoadingProps {
  mobileHeroImage?: ShellChromeLoadingMobileHeroImage;
}

const transparentPixelSrc =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const shellChromeLoadingStyle = {
  background: 'var(--store-background, #ffffff)',
  boxSizing: 'border-box',
  color: 'var(--store-background-text, #111827)',
  padding: '0.75rem 1rem',
  position: 'relative',
  width: '100%',
  zIndex: 1,
} satisfies CSSProperties;

const shellChromeMobileHeroStyle = {
  aspectRatio: '16 / 9',
  display: 'block',
  maxWidth: '100%',
  overflow: 'hidden',
  width: '100%',
} satisfies CSSProperties;

const shellChromeMobileHeroImageStyle = {
  aspectRatio: '16 / 9',
  display: 'block',
  height: 'auto',
  maxWidth: '100%',
  objectFit: 'contain',
  width: '100%',
} satisfies CSSProperties;

const shellChromeLoadingBarStyle = {
  background:
    'linear-gradient(90deg, color-mix(in srgb, var(--store-primary, #2a2c6e) 10%, transparent) 0%, color-mix(in srgb, var(--store-primary, #2a2c6e) 18%, transparent) 50%, color-mix(in srgb, var(--store-primary, #2a2c6e) 10%, transparent) 100%)',
  backgroundSize: '200% 100%',
  borderRadius: '9999px',
  height: '2.5rem',
  width: '100%',
} satisfies CSSProperties;

function LoadingStatus({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-label={label} aria-live="polite" role="status">
      {children}
    </div>
  );
}

export function ShellChromeLoading({
  mobileHeroImage,
}: ShellChromeLoadingProps = {}) {
  return (
    <LoadingStatus label="Loading storefront chrome">
      <div
        className="storefront-shell-loading"
        style={shellChromeLoadingStyle}
      >
        {mobileHeroImage ? (
          <picture
            className="storefront-shell-loading__mobile-hero md:hidden"
            style={shellChromeMobileHeroStyle}
          >
            <source
              media="(max-width: 767px)"
              srcSet={mobileHeroImage.avifSrc}
              type="image/avif"
            />
            <source
              media="(max-width: 767px)"
              srcSet={mobileHeroImage.fallbackSrc}
              type="image/jpeg"
            />
            <img
              alt={mobileHeroImage.alt}
              className="storefront-shell-loading__mobile-hero-image h-full w-full object-contain"
              decoding="sync"
              fetchPriority="high"
              height={540}
              loading="eager"
              src={transparentPixelSrc}
              style={shellChromeMobileHeroImageStyle}
              width={960}
            />
          </picture>
        ) : null}
        <div
          className="storefront-shell-loading__bar"
          style={shellChromeLoadingBarStyle}
        />
      </div>
    </LoadingStatus>
  );
}

export function HomeRouteLoading() {
  return (
    <LoadingStatus label="Loading storefront homepage">
      <StorefrontPageSkeleton />
    </LoadingStatus>
  );
}

export function CatalogListingLoading() {
  return (
    <LoadingStatus label="Loading product listing">
      <div className="min-h-screen bg-white">
        <StorefrontHeaderSkeleton />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8 space-y-4">
            <Skeleton className="h-10 w-56 bg-gray-200" shimmer />
            <Skeleton className="h-4 w-full max-w-2xl bg-gray-200" shimmer />
          </div>
          <ProductGridSkeleton columns={4} count={8} />
        </main>
      </div>
    </LoadingStatus>
  );
}

export function ProductDetailRouteLoading() {
  return (
    <LoadingStatus label="Loading product page">
      <div className="min-h-screen bg-white">
        <StorefrontHeaderSkeleton />
        <div className="container mx-auto px-4 py-8">
          <ProductDetailSkeleton />
        </div>
      </div>
    </LoadingStatus>
  );
}

export function BlogListingRouteLoading() {
  return (
    <LoadingStatus label="Loading blog posts">
      <div className="min-h-screen bg-background pb-20 pt-4">
        <div className="mx-auto max-w-[1400px] px-4 pt-8 md:px-6 md:pt-12">
          <div className="mb-12 overflow-hidden rounded-4xl border border-border bg-card p-6 shadow-sm md:p-8">
            <Skeleton
              className="h-[320px] w-full rounded-3xl bg-muted md:h-[420px]"
              shimmer
            />
            <div className="mt-8 space-y-4">
              <Skeleton className="h-4 w-28 bg-muted" shimmer />
              <Skeleton className="h-10 w-full max-w-3xl bg-muted" shimmer />
              <Skeleton className="h-5 w-full max-w-2xl bg-muted" shimmer />
            </div>
          </div>

          <div className="mb-10 flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: Static fallback pills
                key={index}
                className="h-10 w-28 shrink-0 rounded-full bg-muted"
                shimmer
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Static fallback cards
                key={index}
                className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <Skeleton
                  className="h-64 w-full rounded-[1.25rem] bg-muted"
                  shimmer
                />
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-3 w-1/2 bg-muted" shimmer />
                  <Skeleton className="h-7 w-full bg-muted" shimmer />
                  <Skeleton className="h-7 w-4/5 bg-muted" shimmer />
                  <Skeleton className="h-4 w-full bg-muted" shimmer />
                  <Skeleton className="h-4 w-2/3 bg-muted" shimmer />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingStatus>
  );
}

export function BlogPostRouteLoading() {
  return (
    <LoadingStatus label="Loading blog post">
      <div className="min-h-screen bg-background">
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-4 w-28 bg-muted/40" shimmer />
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          <article className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-10 md:px-12">
            <Skeleton
              className="mb-8 aspect-video w-full rounded-2xl bg-muted/30"
              shimmer
            />
            <div className="mb-8 space-y-4">
              <Skeleton className="h-5 w-20 rounded-full bg-muted/40" shimmer />
              <Skeleton className="h-8 w-3/4 bg-muted/50" shimmer />
              <Skeleton className="h-8 w-1/2 bg-muted/40" shimmer />
              <div className="flex items-center gap-3 pt-2">
                <Skeleton className="size-10 rounded-full bg-muted/40" shimmer />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-24 bg-muted/40" shimmer />
                  <Skeleton className="h-3 w-32 bg-muted/30" shimmer />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-6 w-full bg-muted/40" shimmer />
              <Skeleton className="h-6 w-full bg-muted/40" shimmer />
              <Skeleton className="h-6 w-5/6 bg-muted/30" shimmer />
              <Skeleton className="h-6 w-full bg-muted/40" shimmer />
              <Skeleton className="h-6 w-4/5 bg-muted/30" shimmer />
            </div>
          </article>
        </main>
      </div>
    </LoadingStatus>
  );
}

export function ContentRouteLoading() {
  return (
    <LoadingStatus label="Loading page content">
      <StorefrontPageSkeleton />
    </LoadingStatus>
  );
}

export function CommerceRouteLoading() {
  return (
    <LoadingStatus label="Loading commerce page">
      <StorefrontPageSkeleton />
    </LoadingStatus>
  );
}

export function CustomerRouteLoading() {
  return (
    <LoadingStatus label="Loading customer page">
      <StorefrontPageSkeleton />
    </LoadingStatus>
  );
}

export function UtilityRouteLoading() {
  return (
    <LoadingStatus label="Loading utility page">
      <StorefrontPageSkeleton />
    </LoadingStatus>
  );
}
