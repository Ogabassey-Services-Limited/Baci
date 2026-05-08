'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import { getProductUrl } from '@/lib/seo-utils';
import { asRoute } from '@/lib/routes';
import type { Product } from '../types';

interface HomeProductGridCardProps {
  product: Product;
  basePath?: string;
  deferImageLoading?: boolean;
}

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="48" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';

export function HomeProductGridCard({
  product,
  basePath = '',
  deferImageLoading = false,
}: HomeProductGridCardProps) {
  const { ref: imageViewportRef, isActive: isImageViewportActive } =
    useViewportActivation<HTMLDivElement>({
      enabled: deferImageLoading,
      rootMargin: '150px 0px',
      timeoutMs: 6000,
    });
  const shouldRenderImage = !deferImageLoading || isImageViewportActive;
  const productHref = asRoute(
    `${basePath}${getProductUrl({ ...product, id: String(product.id) })}`
  );
  const productImage = product.image || product.images?.[0] || PLACEHOLDER_IMAGE;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm transition-all duration-300 flex flex-col h-full relative content-auto [contain-intrinsic-size:auto_360px]">
      <Link href={productHref} prefetch={false} className="absolute inset-0 z-0">
        <span className="sr-only">
          {product.name} - {product.price}
        </span>
      </Link>

      <div
        ref={imageViewportRef}
        className="relative aspect-square mb-3 md:mb-4 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden z-10 pointer-events-none"
      >
        {product.condition && (
          <div
            className={`absolute top-3 left-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm z-10 whitespace-nowrap ${
              product.condition === 'New'
                ? 'bg-gray-900'
                : product.condition === 'Open Box'
                  ? 'bg-indigo-600'
                  : product.condition === 'New & Used'
                    ? 'bg-purple-600'
                    : 'bg-stone-500'
            }`}
          >
            {product.condition}
          </div>
        )}

        {shouldRenderImage ? (
          <Image
            src={productImage}
            alt={product.name}
            fill
            sizes="(max-width: 480px) 40vw, (max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
            loading="lazy"
            fetchPriority="low"
            className="object-contain p-4"
          />
        ) : (
          <div className="w-2/3 h-2/3 bg-gray-200 rounded-lg animate-pulse" />
        )}
      </div>

      <div className="flex flex-col flex-1 px-1 pt-1 pointer-events-none">
        <h3 className="font-bold text-base text-gray-900 mb-1 leading-tight line-clamp-2">
          {product.name}
          {product.spec && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 align-middle leading-none tracking-normal">
              {product.spec}
            </span>
          )}
        </h3>

        <div className="mt-auto flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
          <span className="text-primary font-extrabold text-lg tracking-tight">
            {product.price}
          </span>
          <span className="text-xs font-semibold text-gray-900 mb-0.5">
            Details
          </span>
        </div>
      </div>
    </div>
  );
}
