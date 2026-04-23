interface VariantImageObject {
  url?: string | null;
}

interface ProductColorObject {
  name?: string | null;
}

interface ProductVariantMediaLike {
  attributes?: Record<string, string | null | undefined> | null;
  image?: string | null;
  images?: Array<string | null | undefined> | null;
  primary_image?: string | null;
}

type ProductColorInput =
  | Array<string | ProductColorObject | null | undefined>
  | null
  | undefined;

type ProductImageInput =
  | Array<string | VariantImageObject | null | undefined>
  | null
  | undefined;

type ProductColorImagesInput =
  | Record<string, Array<string | null | undefined> | null | undefined>
  | null
  | undefined;

export interface ResolveProductVariantMediaInput {
  colorImages?: ProductColorImagesInput;
  productColors?: ProductColorInput;
  productImages?: ProductImageInput;
  variants?: ProductVariantMediaLike[] | null;
}

export interface ResolvedProductVariantMedia {
  colorImages?: Record<string, string[]>;
  colors?: string[];
  galleryImages: string[];
  imageColorMap: Record<string, string>;
}

function normalizeColorName(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeImageUrl(
  value: string | VariantImageObject | null | undefined
) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value && typeof value === 'object' && typeof value.url === 'string') {
    return value.url.trim();
  }

  return '';
}

function normalizeColorImages(
  colorImages: ProductColorImagesInput
): Record<string, string[]> | undefined {
  if (!colorImages || typeof colorImages !== 'object') {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(colorImages)
      .map(([color, images]) => [
        normalizeColorName(color),
        Array.from(
          new Set(
            (images ?? [])
              .map((image) => normalizeImageUrl(image ?? undefined))
              .filter(Boolean)
          )
        ),
      ])
      .filter(
        (entry): entry is [string, string[]] =>
          entry[0].length > 0 && entry[1].length > 0
      )
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildVariantColorImages(
  variants: ProductVariantMediaLike[] | null | undefined
): Record<string, string[]> | undefined {
  const grouped = new Map<string, Set<string>>();

  for (const variant of variants ?? []) {
    const color = normalizeColorName(
      variant.attributes?.color ?? variant.attributes?.colour
    );

    if (!color) {
      continue;
    }

    const images = [
      normalizeImageUrl(variant.primary_image),
      normalizeImageUrl(variant.image),
      ...(variant.images ?? []).map((image) => normalizeImageUrl(image)),
    ].filter(Boolean);

    if (images.length === 0) {
      continue;
    }

    const bucket = grouped.get(color) ?? new Set<string>();
    for (const image of images) {
      bucket.add(image);
    }
    grouped.set(color, bucket);
  }

  if (grouped.size === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([color, images]) => [
      color,
      Array.from(images),
    ])
  );
}

function normalizeProductColors(productColors: ProductColorInput) {
  const colors = new Set<string>();

  for (const color of productColors ?? []) {
    const normalized =
      typeof color === 'string'
        ? normalizeColorName(color)
        : normalizeColorName(color?.name);

    if (normalized) {
      colors.add(normalized);
    }
  }

  return Array.from(colors);
}

function normalizeProductImages(productImages: ProductImageInput) {
  return Array.from(
    new Set(
      (productImages ?? [])
        .map((image) => normalizeImageUrl(image))
        .filter(Boolean)
    )
  );
}

function flattenColorImages(colorImages: Record<string, string[]>) {
  return Array.from(new Set(Object.values(colorImages).flat()));
}

function buildGalleryImages(
  productImages: ProductImageInput,
  colorImages: Record<string, string[]> | undefined
) {
  const normalizedProductImages = normalizeProductImages(productImages);
  const normalizedColorImages = colorImages
    ? flattenColorImages(colorImages)
    : [];

  return Array.from(
    new Set([...normalizedColorImages, ...normalizedProductImages])
  );
}

function buildImageColorMap(colorImages: Record<string, string[]> | undefined) {
  const imageColorMap: Record<string, string> = {};

  if (!colorImages) {
    return imageColorMap;
  }

  for (const [color, images] of Object.entries(colorImages)) {
    for (const image of images) {
      if (!image || imageColorMap[image]) {
        continue;
      }

      imageColorMap[image] = color;
    }
  }

  return imageColorMap;
}

function buildOrderedColors(args: {
  galleryImages: string[];
  imageColorMap: Record<string, string>;
  productColors: string[];
  variantColorImages?: Record<string, string[]>;
}) {
  const ordered = new Set<string>();

  for (const image of args.galleryImages) {
    const color = args.imageColorMap[image];
    if (color) {
      ordered.add(color);
    }
  }

  for (const color of Object.keys(args.variantColorImages ?? {})) {
    ordered.add(color);
  }

  for (const color of args.productColors) {
    ordered.add(color);
  }

  return Array.from(ordered);
}

export function resolveProductVariantMedia({
  colorImages,
  productColors,
  productImages,
  variants,
}: ResolveProductVariantMediaInput): ResolvedProductVariantMedia {
  const variantColorImages = buildVariantColorImages(variants);
  const resolvedColorImages =
    variantColorImages ?? normalizeColorImages(colorImages);
  const galleryImages = buildGalleryImages(productImages, resolvedColorImages);
  const imageColorMap = buildImageColorMap(resolvedColorImages);
  const colors = buildOrderedColors({
    galleryImages,
    imageColorMap,
    productColors: normalizeProductColors(productColors),
    variantColorImages: resolvedColorImages,
  });

  return {
    colorImages: resolvedColorImages,
    colors: colors.length > 0 ? colors : undefined,
    galleryImages,
    imageColorMap,
  };
}
