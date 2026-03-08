import type {
  Product,
  ProductSpecItem,
  ProductSpecSection,
} from '../../types';
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

export function normalizeProductDetails(
  serverProduct: Product
): NormalizedProductDetails {
  const product = serverProduct as ProductWithDynamicFields;
  const colorImages = product.color_images || {};

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

  const images =
    product.images && product.images.length > 0
      ? [...product.images]
      : product.image
        ? [product.image]
        : [];

  for (const colorImageGroup of Object.values(colorImages)) {
    for (const image of colorImageGroup) {
      if (!images.includes(image)) {
        images.push(image);
      }
    }
  }

  if (images.length === 0) {
    images.push('/placeholder.svg');
  }

  const platforms =
    product.variant_attributes?.Platform?.length
      ? product.variant_attributes.Platform
      : product.variants
        ? Array.from(
            new Set(
              product.variants
                .map((variant) => variant.attributes?.platform)
                .filter(Boolean)
            )
          ) as string[]
        : [];

  const detailedSpecs =
    Array.isArray(product.specifications) && product.specifications.length > 0
      ? product.specifications
      : Array.isArray(product.detailedSpecs) && product.detailedSpecs.length > 0
        ? product.detailedSpecs
        : [
            {
              category: 'General',
              items: [
                { label: 'Brand', value: product.brand || 'Generic' },
                { label: 'Condition', value: product.condition || 'New' },
                {
                  label: 'Category',
                  value:
                    product.categories?.name || product.category || 'General',
                },
              ],
            },
          ];

  const specs =
    product.specs && product.specs.length > 0
      ? product.specs
      : [
          { label: 'Brand', value: product.brand || 'Generic' },
          { label: 'Condition', value: product.condition || 'New' },
        ];

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
