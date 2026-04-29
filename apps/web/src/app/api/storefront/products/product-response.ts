import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import {
  coerceStorefrontManageStock,
  getStorefrontAgentAvailability,
} from '@/lib/storefront-agent-availability';

export const STOREFRONT_PRODUCTS_FULL_SELECT = `
  id,
  merchant_id,
  name,
  slug,
  description,
  images,
  category,
  category_id,
  brand,
  price,
  compare_at_price,
  condition,
  stock,
  stock_quantity,
  status,
  manage_stock,
  low_stock_threshold,
  image_hint,
  specifications,
  product_key_specs,
  has_variants,
  sku,
  has_condition_offers,
  offers,
  color,
  color_images,
  variant_attributes,
  available_conditions,
  variant_model,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;

export const STOREFRONT_PRODUCTS_COMPACT_SELECT = `
  id,
  merchant_id,
  name,
  slug,
  images,
  category,
  category_id,
  brand,
  price,
  compare_at_price,
  condition,
  stock,
  stock_quantity,
  status,
  manage_stock,
  image_hint,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapStorefrontProduct(p: RawDbProduct) {
  const normalized = normalizeProduct(p);
  const manageStock = coerceStorefrontManageStock(p.manage_stock);
  const agentAvailability = getStorefrontAgentAvailability({
    manage_stock: manageStock,
    stock: p.stock,
    stock_quantity: p.stock_quantity,
    low_stock_threshold: p.low_stock_threshold,
  });

  type ImageInput = string | { url?: string; alt?: string; order?: number };
  const rawImages = (p.images as ImageInput[]) || [];
  const processedImages = rawImages.map((img, index) => {
    if (typeof img === 'string') {
      return { url: img, alt: normalized.name, order: index };
    }

    return {
      url: img.url || '',
      alt: img.alt || normalized.name,
      order: img.order ?? index,
    };
  });

  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    price: normalized.price,
    compare_at_price: normalized.compare_at_price,
    image: normalized.image,
    imageLarge: normalized.imageLarge,
    rating: normalized.rating,
    availability: agentAvailability.availability,
    inventory_policy: agentAvailability.inventory_policy,
    is_purchasable: agentAvailability.is_purchasable,
    quantity_available: agentAvailability.quantity_available,
    category: normalized.category,
    category_slug: normalized.category_slug,
    brand: normalized.brand || '',
    stock: normalized.stock,
    slug: normalized.slug,
    status: normalized.status || 'active',
    condition: normalized.condition,
    imageHint: (p.image_hint as string) || '',
    images: processedImages,
    has_variants: p.has_variants,
    sku: p.sku,
    manage_stock: manageStock,
    low_stock_threshold: p.low_stock_threshold,
    specifications: p.specifications,
    product_key_specs: normalized.product_key_specs,
    has_condition_offers: p.has_condition_offers,
    offers: p.offers,
    colors:
      (typeof p.color === 'string' && p.color ? [p.color] : undefined) ||
      (isPlainObject(p.color_images) ? Object.keys(p.color_images) : []),
    variant_attributes: p.variant_attributes,
    categories:
      (p.categories as { id?: string; name?: string; slug?: string } | null) ??
      null,
    category_id: p.category_id as string | undefined,
  };
}
