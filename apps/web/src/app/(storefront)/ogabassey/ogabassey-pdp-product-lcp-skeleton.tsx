import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps, CSSProperties } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import type { CachedMerchant } from '@/lib/cached-data';
import { ogabasseyFallbackImageLoader } from '@/lib/ogabassey-image-fallback-loader';
import { buildOgabasseyAvifSrcSet } from '@/lib/ogabassey-image-format-sources';

interface LcpSkeletonProps {
  merchant: CachedMerchant | null;
  primaryProductImage: string | null;
  productName?: string | null;
}

// `<picture display:contents>` generates no box, so the absolutely-positioned
// `<img>` still resolves its containing block against the relative image frame.
const PICTURE_STYLE: CSSProperties = { display: 'contents' };

type NativeImagePropsWithNextInternals = ComponentProps<'img'> & {
  fill?: unknown;
  loader?: unknown;
  priority?: unknown;
  quality?: unknown;
};

export function OgabasseyPdpProductLcpSkeleton({
  merchant,
  primaryProductImage,
  productName,
}: LcpSkeletonProps) {
  if (!merchant || merchant.template_id !== OGABASSEY_TEMPLATE_ID) {
    return null;
  }

  if (!primaryProductImage) {
    return (
      <div
        role="status"
        className="mx-auto block max-w-[1400px] px-4 md:px-6 mt-12 w-full animate-pulse"
        data-testid="ogabassey-pdp-lcp-skeleton"
        aria-busy="true"
        aria-label="Loading product details"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-6 lg:col-span-5">
            <div className="aspect-square rounded-2xl bg-muted/20" />
          </div>
        </div>
      </div>
    );
  }

  const productImageAlt = productName?.trim() || 'Loading product';
  const { props: imgProps } = getImageProps({
    alt: productImageAlt,
    fill: true,
    // Shared fallback loader → jpeg/png `<img>` tier; the AVIF `<source>` is
    // derived from its srcSet so both tiers differ ONLY in the format token and
    // stay byte-identical to the PDP resource-hint preload.
    loader: ogabasseyFallbackImageLoader,
    priority: true,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
    src: primaryProductImage,
  });
  const {
    fill: _fill,
    loader: _loader,
    priority: _priority,
    quality: _quality,
    ...nativeImgProps
  } = imgProps as NativeImagePropsWithNextInternals;
  // AVIF twin of the fallback srcSet. `null` for non-CDN sources (external
  // merchants have no AVIF tier) — the skeleton then paints the bare `<img>`.
  const avifSrcSet = buildOgabasseyAvifSrcSet(nativeImgProps.srcSet);
  const imageFrameStyle: CSSProperties = {
    alignItems: 'center',
    aspectRatio: '1 / 1',
    backgroundColor: 'hsl(var(--muted) / 0.05)',
    border: '1px solid hsl(var(--border) / 0.4)',
    borderRadius: '1rem',
    display: 'flex',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  };
  const imageStyle: CSSProperties = {
    ...nativeImgProps.style,
    height: '100%',
    inset: 0,
    objectFit: 'cover',
    position: 'absolute',
    width: '100%',
  };

  return (
    <div
      role="status"
      className="mx-auto block max-w-[1400px] px-4 md:px-6 mt-12 w-full"
      data-testid="ogabassey-pdp-lcp-skeleton"
      aria-busy="true"
      aria-label="Loading product details"
    >
      {/* 1. Breadcrumbs Skeleton */}
      <div className="flex items-center gap-x-2 py-4 text-sm text-muted-foreground/40 animate-pulse">
        <div className="h-4 bg-muted/20 rounded w-12" />
        <span>/</span>
        <div className="h-4 bg-muted/20 rounded w-16" />
        <span>/</span>
        <div className="h-4 bg-muted/20 rounded w-24" />
      </div>

      {/* 2. Primary Product Image Grid Skeleton (Statically painted image) */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-5">
          <div
            className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-muted/5"
            style={imageFrameStyle}
          >
            <picture style={PICTURE_STYLE}>
              {avifSrcSet ? (
                <source
                  sizes={nativeImgProps.sizes}
                  srcSet={avifSrcSet}
                  type="image/avif"
                />
              ) : null}
              {/* Native <img> inside <picture> for synchronous instant paint of
                  the server-rendered LCP skeleton. */}
              <img
                {...nativeImgProps}
                alt={productImageAlt}
                className="object-cover w-full h-full absolute inset-0"
                style={imageStyle}
                fetchPriority="high"
                decoding="sync"
              />
            </picture>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="size-24 shrink-0 rounded-xl bg-muted/20"
              />
            ))}
          </div>
        </div>

        {/* 3. Product Details Skeleton */}
        <div className="lg:col-span-4 space-y-6 animate-pulse">
          <div className="h-8 bg-muted/20 rounded w-3/4" />
          <div className="h-6 bg-muted/20 rounded w-1/4" />
          <hr className="border-border/40" />
          <div className="h-4 bg-muted/20 rounded w-full" />
          <div className="h-4 bg-muted/20 rounded w-5/6" />
          <div className="h-4 bg-muted/20 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}
