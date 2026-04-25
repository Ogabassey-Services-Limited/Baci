import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';

export const STOREFRONT_PRODUCTS_FULL_SELECT = `
  *,
  category_id,
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

export function mapStorefrontProduct(p: RawDbProduct) {
  const normalized = normalizeProduct(p);

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
    availability: normalized.availability,
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
    // Default missing/null manage_stock to `true` (managed) to match the
    // rest of the codebase (e.g. `/api/products/[id]`, `/api/products`,
    // Google Merchant feed). Treating null as unmanaged would expose
    // products with out-of-stock inventory as perpetually available.
    manage_stock: (p.manage_stock as boolean | null | undefined) ?? true,
    low_stock_threshold: p.low_stock_threshold,
    specifications: p.specifications,
    product_key_specs: normalized.product_key_specs,
    has_condition_offers: p.has_condition_offers,
    offers: p.offers,
    colors:
      (p.colors as string[]) ||
      (p.color_images ? Object.keys(p.color_images as object) : []),
    variant_attributes: p.variant_attributes,
    categories:
      (p.categories as { id?: string; name?: string; slug?: string } | null) ??
      null,
    category_id: p.category_id as string | undefined,
  };
}
