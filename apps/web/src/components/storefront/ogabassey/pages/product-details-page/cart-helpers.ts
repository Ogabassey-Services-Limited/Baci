import type { Product as CartProduct } from '@/lib/products';
import type { Product } from '../../types';
import type { ConditionType } from './product-condition';
import type { ProductDetailsCurrentOffer } from './offer-resolution';
import type { NormalizedProductDetails } from './product-normalization';
import { toRelatedProductsProduct } from './related-product';

export function buildCartItemId(
  productId: Product['id'],
  options?: {
    color?: string;
    condition?: string;
    storage?: string;
    variantId?: string;
  }
) {
  const parts = [String(productId)];
  if (options?.variantId) {
    parts.push(options.variantId);
  }
  if (options?.color) {
    parts.push(options.color);
  }
  if (options?.storage) {
    parts.push(options.storage);
  }
  if (options?.condition) {
    parts.push(options.condition);
  }
  return parts.join('-');
}

export function getEffectiveAxes(
  serverProduct: Product,
  productData: NormalizedProductDetails
) {
  if (serverProduct.attributeAxes?.length) {
    return serverProduct.attributeAxes;
  }

  const axes: string[] = [];
  if (productData.storage.length > 0) {
    axes.push('storage');
  }
  if (productData.platforms.length > 0) {
    axes.push('platform');
  }
  return axes;
}

export function getAxisOptions(
  axis: string,
  productData: NormalizedProductDetails
) {
  if (axis === 'storage' && productData.storage.length > 0) {
    return productData.storage;
  }

  if (axis === 'platform' && productData.platforms.length > 0) {
    return productData.platforms;
  }

  if (!productData.variants) {
    return [];
  }

  return Array.from(
    new Set(
      productData.variants
        .map((variant) => variant.attributes?.[axis])
        .filter(Boolean)
    )
  ) as string[];
}

export function formatAxisLabel(axis: string) {
  const labels: Record<string, string> = {
    storage: 'Storage',
    ram: 'RAM',
    color: 'Color',
    platform: 'Platform',
    processor: 'Processor',
    gpu: 'GPU',
    sim_type: 'SIM Type',
  };

  return (
    labels[axis] ||
    `${axis.charAt(0).toUpperCase()}${axis.slice(1).replace(/_/g, ' ')}`
  );
}

export function getMissingSelectionFields(
  productData: NormalizedProductDetails,
  effectiveAxes: string[],
  selectedColor: number | null,
  selectedAttributes: Record<string, string>
) {
  const missing: string[] = [];

  if (selectedColor === null && productData.colors.length > 0) {
    missing.push('Color');
  }

  for (const axis of effectiveAxes.filter((item) => item !== 'color')) {
    if (
      !selectedAttributes[axis] &&
      getAxisOptions(axis, productData).length > 0
    ) {
      missing.push(formatAxisLabel(axis));
    }
  }

  return missing;
}

export function buildCartProduct(
  productData: NormalizedProductDetails,
  currentOffer: ProductDetailsCurrentOffer,
  selectedImage: number,
  selectedCondition: ConditionType,
  selectedAttributes: Record<string, string>
): CartProduct {
  const baseProduct = toRelatedProductsProduct(productData);

  return {
    ...baseProduct,
    price: currentOffer.rawPrice,
    image: productData.images[selectedImage],
    imageLarge: productData.images[selectedImage],
    description: productData.description,
    rating: productData.rating,
    category: productData.categories?.name || productData.category,
    condition: selectedCondition,
    ...selectedAttributes,
  };
}
