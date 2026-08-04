import { isStorefrontProductVariantPublic } from '@/lib/is-storefront-product-variant-public';

type ProductVariantImageSource = {
  archived_at?: string | null;
  deleted_at?: string | null;
  images: unknown;
  is_active?: boolean | null;
  is_inventory_anchor?: boolean | null;
  primary_image: string | null;
  status?: string | null;
};

type ProductImageSource = {
  images: unknown;
  product_variants: readonly ProductVariantImageSource[] | null;
};

function hasNonBlankUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPublicImage(images: unknown): boolean {
  return (
    Array.isArray(images) &&
    images.some(
      (image) =>
        hasNonBlankUrl(image) ||
        (typeof image === 'object' &&
          image !== null &&
          'url' in image &&
          hasNonBlankUrl(image.url))
    )
  );
}

function hasEffectivePublicImage(product: ProductImageSource): boolean {
  return (
    hasPublicImage(product.images) ||
    product.product_variants?.some(
      (variant) =>
        isStorefrontProductVariantPublic(variant) &&
        (Boolean(variant.primary_image?.trim()) ||
          hasPublicImage(variant.images))
    ) === true
  );
}

export function countProductsMissingEffectivePublicImages(
  products: readonly ProductImageSource[]
): number {
  return products.filter((product) => !hasEffectivePublicImage(product)).length;
}
