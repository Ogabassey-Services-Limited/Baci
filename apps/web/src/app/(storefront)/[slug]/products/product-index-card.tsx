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

  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--store-background-text,#111827)]/10 bg-[var(--store-background,#ffffff)] shadow-sm transition-shadow hover:shadow-lg">
      <Link
        href={asRoute(productPath)}
        prefetch={false}
        className="block h-full"
      >
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
          {(product.has_condition_offers ||
            (product.condition && product.condition !== 'New')) && (
            <output
              aria-label={`Condition: ${product.has_condition_offers ? 'New & Used' : product.condition}`}
              className="absolute top-2 right-2 rounded-full bg-[var(--store-primary)] px-2 py-0.5 text-xs font-bold uppercase text-white"
            >
              {product.has_condition_offers ? 'New & Used' : product.condition}
            </output>
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
