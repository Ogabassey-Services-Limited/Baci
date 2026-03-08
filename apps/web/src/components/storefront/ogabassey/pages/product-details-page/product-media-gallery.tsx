import Image from 'next/image';
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

  return (
    <div className="space-y-6 lg:col-span-5">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        <Image
          src={productData.images[selectedImage]}
          alt={productData.name}
          fill
          className="object-cover transition-all duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
        <div
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${badgeClass}`}
        >
          {formatConditionLabel(badgeCondition)}
        </div>
      </div>

      <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-2">
        {productData.images.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => onSelectImage(index)}
            className={`relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-0 transition-all active:scale-95 ${
              selectedImage === index
                ? 'border-2 border-[var(--store-primary)] ring-2 ring-[var(--store-primary)]/20'
                : 'border-2 border-transparent md:hover:border-gray-200'
            }`}
          >
            <Image
              src={image}
              alt={`View ${index}`}
              fill
              className="object-cover"
              sizes="96px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
