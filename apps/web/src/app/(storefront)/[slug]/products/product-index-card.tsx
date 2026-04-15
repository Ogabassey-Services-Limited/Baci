import Image from 'next/image';
import Link from 'next/link';
import type { NormalizedProduct } from '@/lib/normalize-product';
import { asRoute } from '@/lib/routes';
import { getProductUrl } from '@/lib/seo-utils';

interface ProductIndexCardProps {
  formattedPrice: string;
  pathPrefix: string;
  product: NormalizedProduct;
}

function hasRenderableImage(image?: string | null) {
  return typeof image === 'string' && image.trim() !== '';
}

function getConditionBadgeLabel(product: NormalizedProduct) {
  const formatConditionBadgeLabel = (condition: string) =>
    condition
      .trim()
      .toLowerCase()
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');

  if (Array.isArray(product.available_conditions)) {
    const normalizedConditions = product.available_conditions
      .filter((condition): condition is string => typeof condition === 'string')
      .map((condition) => condition.trim().toLowerCase())
      .filter(Boolean);

    if (
      normalizedConditions.length > 1 &&
      normalizedConditions.includes('new') &&
      normalizedConditions.includes('used')
    ) {
      return 'New & Used';
    }

    if (normalizedConditions.length === 1) {
      return formatConditionBadgeLabel(normalizedConditions[0]);
    }

    if (normalizedConditions.length > 1) {
      return 'Multiple Conditions';
    }
  }

  if (product.has_condition_offers) {
    return 'New & Used';
  }

  const normalizedProductCondition =
    typeof product.condition === 'string'
      ? product.condition.trim().toLowerCase()
      : '';

  return normalizedProductCondition && normalizedProductCondition !== 'new'
    ? formatConditionBadgeLabel(normalizedProductCondition)
    : null;
}

export function ProductIndexCard({
  formattedPrice,
  pathPrefix,
  product,
}: ProductIndexCardProps) {
  const productPath = `${pathPrefix}${getProductUrl({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    category_slug: product.category_slug,
  })}`;
  const conditionBadgeLabel = getConditionBadgeLabel(product);

  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--store-background-text,#111827)]/10 bg-[var(--store-background,#ffffff)] shadow-sm transition-shadow hover:shadow-lg">
      <Link href={asRoute(productPath)} className="block h-full">
        <div className="relative aspect-square bg-[var(--store-background-text,#111827)]/5">
          {hasRenderableImage(product.image) ? (
            <Image
              alt={product.name}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              src={product.image}
            />
          ) : (
            <div
              role="img"
              aria-label={`No image available for ${product.name}`}
              className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-[var(--store-background-text,#111827)]/45"
            >
              Image coming soon
            </div>
          )}
          {conditionBadgeLabel && (
            <span className="absolute top-2 right-2 rounded-full bg-[var(--store-primary)] px-2 py-0.5 text-xs font-bold uppercase text-white">
              {conditionBadgeLabel}
            </span>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="space-y-1">
            {product.category && (
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--store-primary)]/80">
                {product.category}
              </p>
            )}
            <h2 className="line-clamp-2 text-base font-semibold text-[var(--store-background-text,#111827)]">
              {product.name}
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--store-background-text,#111827)]">
              {formattedPrice}
            </p>
            <span className="text-xs font-medium text-[var(--store-background-text,#111827)]/45">
              View
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
