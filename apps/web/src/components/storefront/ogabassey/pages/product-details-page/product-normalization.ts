import { z } from 'zod';
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

const ImageUrlSchema = z.string()
  .nullish()
  .transform((val) => {
    if (!val) return '/placeholder.svg';
    // Strip literal double quotes and whitespace
    const cleaned = val.trim().replace(/^"|"$/g, '');
    return cleaned || '/placeholder.svg';
  })
  .pipe(z.string());

const ColorImagesSchema = z
  .record(z.string(), z.array(ImageUrlSchema).nullish())
  .nullish()
  .transform((val) => {
    if (!val) return {};
    const result: Record<string, string[]> = {};
    for (const [color, images] of Object.entries(val)) {
      result[color] = (images || []).filter(
        (url) => url !== '/placeholder.svg'
      );
    }
    return result;
  });

export function normalizeProductDetails(
  serverProduct: Product
): NormalizedProductDetails {
  const product = serverProduct as ProductWithDynamicFields;

  // 2026 Best Practice: Parse complex JSONB fields through Zod boundaries
  const colorImages = ColorImagesSchema.parse(product.color_images);

  let colors: ProductColorOption[] = [];
  if (Object.keys(colorImages).length > 0) {
    colors = Object.keys(colorImages).map((colorName) => ({
      name: colorName,
      value: getColorHex(colorName),
    }));
  } else if (product.colors && product.colors.length > 0) {
    colors = product.colors.map((color) => {
      const normalizedColor =
        typeof color === 'string'
          ? { name: color, value: getColorHex(color) }
          : color;

      return {
        name: normalizedColor.name,
        value: normalizedColor.value,
      };
    });
  }

  const storage = product.storage
    ? Array.isArray(product.storage)
      ? product.storage
      : [product.storage]
    : [];

  // Start with sanitized main images
  const mainImages = z
    .array(ImageUrlSchema)
    .parse(product.images || [])
    .filter((url) => url !== '/placeholder.svg');

  // Fallback to sanitized single image
  const singleImage = ImageUrlSchema.parse(product.image);

  let images = [...mainImages];
  if (images.length === 0 && singleImage !== '/placeholder.svg') {
    images.push(singleImage);
  }

  // Merge color-specific images into the main gallery
  for (const colorImageGroup of Object.values(colorImages)) {
    for (const image of colorImageGroup) {
      images.push(image);
    }
  }

  // Deduplicate and final fallback
  images = Array.from(new Set(images));
  if (images.length === 0) {
    images.push('/placeholder.svg');
  }

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
