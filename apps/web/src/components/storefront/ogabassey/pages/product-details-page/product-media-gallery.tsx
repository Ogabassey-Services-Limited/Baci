import Image from 'next/image';
import { DeferredShellFeature } from '@/components/storefront/ogabassey/components/deferred-shell-feature';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import type {
  ConditionType,
  NormalizedProductDetails,
} from './product-details-helpers';
import { formatConditionLabel } from './product-condition';

interface ProductMediaGalleryProps {
  onSelectImage: (index: number) => void;
  productData: NormalizedProductDetails;
  selectedCondition: ConditionType;
  selectedImage: number;
}

export function ProductMediaGallery({
  onSelectImage,
  productData,
  selectedCondition,
  selectedImage,
}: ProductMediaGalleryProps) {
  const badgeCondition = (
    selectedCondition ||
    productData.condition ||
    'new'
  ).toLowerCase();
  const badgeClass =
    badgeCondition === 'new'
      ? 'bg-store-primary text-store-primary-text'
      : 'bg-[color-mix(in_srgb,var(--store-primary)_65%,var(--store-background-text,#111827))] text-store-primary-text';
  const thumbnailFallback = (
    <div
      aria-hidden="true"
      className="hide-scrollbar flex gap-4 overflow-x-auto pb-2"
    >
      {productData.images.slice(0, 4).map((image, index) => (
        <div
          key={`${image}-${index}`}
          className="h-24 w-24 shrink-0 rounded-xl bg-gray-100"
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6 lg:col-span-5">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        <Image
          src={productData.images[selectedImage]}
          alt={productData.name}
          fill
          className="object-cover"
          sizes={OGABASSEY_PDP_PRIMARY_IMAGE_SIZES}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          quality={OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY}
        />
        <div
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${badgeClass}`}
        >
          {formatConditionLabel(badgeCondition)}
        </div>
      </div>

      <DeferredShellFeature fallback={thumbnailFallback} timeoutMs={1200}>
        <div
          className="hide-scrollbar flex gap-4 overflow-x-auto pb-2"
          aria-label="Product media thumbnails"
        >
          {productData.images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => onSelectImage(index)}
              aria-label={`View image ${index + 1}`}
              className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-0 transition-all active:scale-95 ${
                selectedImage === index
                  ? 'border-2 border-store-primary ring-2 ring-store-primary/20'
                  : 'border-2 border-transparent md:hover:border-gray-200'
              }`}
            >
              <Image
                src={image}
                alt={`View ${index + 1}`}
                fill
                className="object-cover"
                sizes="96px"
                loading="lazy"
                quality={50}
              />
            </button>
          ))}
        </div>
      </DeferredShellFeature>
    </div>
  );
}
