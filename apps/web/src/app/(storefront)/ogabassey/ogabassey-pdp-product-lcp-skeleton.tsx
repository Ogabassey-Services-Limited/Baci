import 'server-only';
import { getImageProps } from 'next/image';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import imageLoader from '@/lib/image-loader';
import { getCachedStorefrontProductLcpImage } from '@/lib/storefront-product-lcp-image';

interface LcpSkeletonProps {
  slug: string;
  productSlug: string;
}

export async function OgabasseyPdpProductLcpSkeleton({
  slug,
  productSlug,
}: LcpSkeletonProps) {
  const merchant = await getRequestScopedMerchant(slug);
  if (!merchant || merchant.template_id !== OGABASSEY_TEMPLATE_ID) {
    return null;
  }

  const primaryProductImage = await getCachedStorefrontProductLcpImage(
    merchant.id,
    productSlug
  );

  if (!primaryProductImage) {
    return (
      <div
        className="mx-auto max-w-[1400px] px-4 md:px-6 mt-12 w-full animate-pulse"
        data-testid="ogabassey-pdp-lcp-skeleton"
        role="status"
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

  const {
    props: { src, srcSet, sizes },
  } = getImageProps({
    alt: 'Product Image',
    fill: true,
    loader: imageLoader,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
    src: primaryProductImage,
  });

  return (
    <div
      className="mx-auto max-w-[1400px] px-4 md:px-6 mt-12 w-full"
      data-testid="ogabassey-pdp-lcp-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading product details"
    >
      {/* 1. Breadcrumbs Skeleton */}
      <div className="flex items-center space-x-2 py-4 text-sm text-muted-foreground/40 animate-pulse">
        <div className="h-4 bg-muted/20 rounded w-12" />
        <span>/</span>
        <div className="h-4 bg-muted/20 rounded w-16" />
        <span>/</span>
        <div className="h-4 bg-muted/20 rounded w-24" />
      </div>

      {/* 2. Primary Product Image Grid Skeleton (Statically painted image) */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-5">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-muted/5">
            {/* biome-ignore lint/performance/noImgElement: Native HTML img used synchronously inside server-rendered skeleton to ensure instant painting */}
            <img
              src={src}
              srcSet={srcSet}
              sizes={sizes}
              alt="Loading product"
              className="object-cover w-full h-full absolute inset-0"
              fetchPriority="high"
              decoding="sync"
            />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 w-24 shrink-0 rounded-xl bg-muted/20"
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
