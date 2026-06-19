import { resolveProductVariantMedia } from '@baci/shared/lib';
import { getVariantAttributeOptions } from '@/components/storefront/ogabassey/variant-attributes';
import type {
  Product,
  ProductSpecItem,
  ProductSpecSection,
} from '../../types';
import { buildOgabasseyProductSpecData } from '../../product-spec-data';
import {
  normalizeConditionType,
  type ConditionType,
} from './product-condition';

interface ProductWithDynamicFields extends Product {
  color_images?: Record<string, string[]>;
  variant_attributes?: Record<string, string[]>;
  specifications?: ProductSpecSection[];
}

export interface ProductColorOption {
  name: string;
  value: string;
}

export interface NormalizedProductDetails extends ProductWithDynamicFields {
  colorImages: Record<string, string[]>;
  colors: ProductColorOption[];
  condition: ConditionType;
  description: string;
  detailedSpecs: ProductSpecSection[];
  images: string[];
  platforms: string[];
  rating: number;
  reviewCount: number;
  specs: ProductSpecItem[];
  storage: string[];
}

function getColorHex(name: string) {
  const lower = name.toLowerCase();

  if (
    lower.includes('black') ||
    lower.includes('obsidian') ||
    lower.includes('midnight') ||
    lower.includes('graphite') ||
    lower.includes('space grey')
  ) {
    return '#1a1a1a';
  }

  if (
    lower.includes('white') ||
    lower.includes('starlight') ||
    lower.includes('porcelain')
  ) {
    return '#f2f2f2';
  }

  if (
    lower.includes('blue') ||
    lower.includes('bay') ||
    lower.includes('pacific')
  ) {
    return '#2f3d4d';
  }

  if (
    lower.includes('natural') ||
    lower.includes('grey') ||
    lower.includes('gray')
  ) {
    return '#808080';
  }

  if (lower.includes('silver')) {
    return '#e0e0e0';
  }

  if (lower.includes('gold')) {
    return '#F5E0C3';
  }

  return '#cccccc';
}

const PLACEHOLDER_IMAGE = '/placeholder.svg';

// Storefront product props are already-trusted Server Component data (built in
// page.tsx), not an API boundary — so these normalize/clean image URLs rather
// than validate them. Kept as plain helpers to keep zod out of the client bundle.
function cleanImageUrl(value?: string | null): string {
  if (typeof value !== 'string' || !value) return PLACEHOLDER_IMAGE;
  // Strip wrapping literal double quotes and surrounding whitespace.
  const cleaned = value.trim().replace(/^"|"$/g, '');
  return cleaned || PLACEHOLDER_IMAGE;
}

function normalizeImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanImageUrl)
    .filter((url) => url !== PLACEHOLDER_IMAGE);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeColorImages(value?: unknown): Record<string, string[]> {
  if (!isPlainRecord(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [color, images] of Object.entries(value)) {
    result[color] = normalizeImageList(images);
  }
  return result;
}

export function normalizeProductDetails(
  serverProduct: Product
): NormalizedProductDetails {
  const product = serverProduct as ProductWithDynamicFields;

  const mainImages = normalizeImageList(product.images);

  const singleImage = cleanImageUrl(product.image);
  const resolvedVariantMedia = resolveProductVariantMedia({
    colorImages: normalizeColorImages(product.color_images),
    productColors: product.colors,
    productImages: [
      ...mainImages,
      ...(singleImage !== PLACEHOLDER_IMAGE ? [singleImage] : []),
    ],
    variants: product.variants,
  });
  const colorImages = resolvedVariantMedia.colorImages ?? {};
  const colors =
    resolvedVariantMedia.colors?.map((colorName: string) => ({
      name: colorName,
      value: getColorHex(colorName),
    })) ??
    [];
  const storage = product.storage
    ? Array.isArray(product.storage)
      ? product.storage
      : [product.storage]
    : [];
  const images =
    resolvedVariantMedia.galleryImages.length > 0
      ? [...resolvedVariantMedia.galleryImages]
      : [PLACEHOLDER_IMAGE];

  const platforms = (() => {
    const platformOptions = getVariantAttributeOptions(
      product.variant_attributes,
      'platform'
    );

    if (platformOptions.length > 0) {
      return platformOptions;
    }

    return product.variants
      ? (Array.from(
          new Set(
            product.variants
              .map((variant) => variant.attributes?.platform)
              .filter(
                (platform): platform is string => typeof platform === 'string'
              )
          )
        ))
      : [];
  })();

  const { detailedSpecs, specs } = buildOgabasseyProductSpecData(product);

  return {
    ...product,
    colorImages,
    colors,
    condition: normalizeConditionType(product.condition),
    description: product.description || 'No description available.',
    detailedSpecs,
    images,
    platforms,
    rating: product.rating || 0,
    reviewCount: product.reviews || 0,
    specs,
    storage,
  };
}
