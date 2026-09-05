import {
  getEffectiveProductStock,
  type ProductSelectionRequiredInput,
} from '@baci/shared/lib';

interface ChatProductRow extends ProductSelectionRequiredInput {
  brand: string | null;
  category: string | null;
  description: string | null;
  has_variants?: boolean | null;
  id: string;
  images: unknown;
  manage_stock?: boolean | null;
  name: string;
  price: number;
  slug?: string | null;
  status: string | null;
  stock: number | null;
  stock_quantity?: number | null;
}

export interface ChatProductResult extends ProductSelectionRequiredInput {
  brand: string | null;
  category: string | null;
  description: string | null;
  has_variants?: boolean;
  id: string;
  image_url: string | null;
  manage_stock?: boolean;
  name: string;
  price: number;
  slug?: string | null;
  status: string | null;
  stock: number | null;
}

function getFirstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;

  const firstImage = images[0];
  if (
    typeof firstImage !== 'object' ||
    firstImage === null ||
    !('url' in firstImage) ||
    typeof firstImage.url !== 'string'
  ) {
    return null;
  }

  return firstImage.url;
}

/** Maps the exact public fields a chat card may receive from catalog tools. */
export function createChatProductResult(
  product: ChatProductRow
): ChatProductResult {
  return {
    brand: product.brand,
    category: product.category,
    description: product.description,
    ...(product.available_conditions !== undefined
      ? { available_conditions: product.available_conditions }
      : {}),
    ...(product.has_condition_offers !== undefined
      ? { has_condition_offers: product.has_condition_offers }
      : {}),
    ...(product.variant_model !== undefined
      ? { variant_model: product.variant_model }
      : {}),
    ...(product.has_variants !== undefined
      ? { has_variants: product.has_variants === true }
      : {}),
    id: product.id,
    image_url: getFirstImageUrl(product.images),
    ...(product.manage_stock !== undefined
      ? { manage_stock: product.manage_stock === true }
      : {}),
    name: product.name,
    price: product.price,
    ...(product.slug !== undefined ? { slug: product.slug } : {}),
    status: product.status,
    stock: getEffectiveProductStock(product),
  };
}
