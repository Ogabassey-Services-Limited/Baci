import { resolveProductVariantMedia } from '@baci/shared/lib';

interface ProductVariantWriteInput {
  attributes?: Record<string, string> | null;
  images?: Array<{ url?: string | null } | string | null> | null;
  primary_image?: string | null;
}

interface ProductImageWriteInput {
  url?: string | null;
}

interface DeriveProductVariantWriteProjectionsInput {
  fallbackColor?: string | null;
  hasVariants: boolean;
  productImages?: ProductImageWriteInput[] | null;
  variants?: ProductVariantWriteInput[] | null;
}

function normalizeVariantImages(
  images: ProductVariantWriteInput['images']
): string[] | undefined {
  const normalized = (images ?? [])
    .map((image) =>
      typeof image === 'string' ? image.trim() : (image?.url?.trim() ?? '')
    )
    .filter((image): image is string => image.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

export function deriveProductVariantWriteProjections({
  fallbackColor,
  hasVariants,
  productImages,
  variants,
}: DeriveProductVariantWriteProjectionsInput) {
  if (!hasVariants) {
    return {
      color: fallbackColor?.trim() || null,
    };
  }

  const resolvedVariantMedia = resolveProductVariantMedia({
    productColors: fallbackColor ? [fallbackColor] : undefined,
    productImages: productImages?.map((image) => image?.url ?? null),
    variants:
      variants?.map((variant) => ({
        attributes: variant.attributes ?? undefined,
        images: normalizeVariantImages(variant.images),
        primary_image: variant.primary_image ?? undefined,
      })) ?? [],
  });

  return {
    color: resolvedVariantMedia.colors?.[0] ?? null,
  };
}
