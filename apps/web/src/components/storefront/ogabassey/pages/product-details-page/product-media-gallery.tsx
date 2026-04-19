import Image from 'next/image';
import { DeferredShellFeature } from '@/components/storefront/ogabassey/components/deferred-shell-feature';
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
      ? 'bg-[var(--store-primary)] text-[var(--store-primary-text,#ffffff)]'
      : 'bg-[color:color-mix(in_srgb,var(--store-primary)_65%,var(--store-background-text,#111827))] text-[var(--store-primary-text,#ffffff)]';
  const thumbnailFallback = (
    <div
      aria-hidden="true"
      className="hide-scrollbar flex gap-4 overflow-x-auto pb-2"
    >
      {productData.images.slice(0, 4).map((image, index) => (
        <div
          key={`${image}-${index}`}
          className="h-24 w-24 flex-shrink-0 rounded-xl bg-gray-100"
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
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
          fetchPriority="high"
          quality={70}
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
              className={`relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-0 transition-all active:scale-95 ${
                selectedImage === index
                  ? 'border-2 border-[var(--store-primary)] ring-2 ring-[var(--store-primary)]/20'
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
