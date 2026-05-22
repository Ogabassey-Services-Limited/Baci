import { normalizeProductKeySpecs } from '@/lib/product-key-specs-normalize';
import type { Product } from '@/lib/products';
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';
import {
  getMappedCanonicalUrl,
  normalizeProductImages,
  type RawProductImage,
  type StorefrontProductVariants,
} from './product-mappers';

const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

function normalizeProductStatus(value: string | null | undefined) {
  return PRODUCT_STATUSES.includes(value as (typeof PRODUCT_STATUSES)[number])
    ? (value as Product['status'])
    : 'active';
}

export interface LegacyCachedProduct {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  slug?: string | null;
  canonical_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  keywords?: string[] | null;
  sale_price?: number | null;
  base_price: number;
  min_variant_price?: number | null;
  max_variant_price?: number | null;
  track_quantity?: boolean | null;
  quantity?: number | null;
  images?: RawProductImage[] | null;
  product_variants?: StorefrontProductVariants;
  product_categories?: Array<{
    categories:
      | {
          id: string;
          name: string;
          slug: string;
        }
      | Array<{
          id: string;
          name: string;
          slug: string;
        }>
      | null;
  }> | null;
  specifications?: unknown;
  product_key_specs?: unknown;
}

export function mapLegacyCachedProductToProduct(
  cachedProduct: LegacyCachedProduct,
  merchantId: string
): Product {
  const rawPrimaryCategory = cachedProduct.product_categories?.[0]?.categories;
  const primaryCategory = Array.isArray(rawPrimaryCategory)
    ? rawPrimaryCategory[0]
    : rawPrimaryCategory;
  const normalizedImages = normalizeProductImages(
    cachedProduct.name,
    cachedProduct.images
  );
  const firstImage = normalizedImages?.[0]?.url || '';
  const normalizedVariants = normalizeStorefrontProductVariants(
    cachedProduct.product_variants,
    {
      merchantId,
      productId: cachedProduct.id,
    }
  );

  return {
    id: cachedProduct.id,
    name: cachedProduct.name,
    description: cachedProduct.description || '',
    status: normalizeProductStatus(cachedProduct.status),
    slug: cachedProduct.slug || cachedProduct.id,
    canonical_url: getMappedCanonicalUrl({
      id: cachedProduct.id,
      name: cachedProduct.name,
      slug: cachedProduct.slug,
      category: primaryCategory?.name,
      category_slug: primaryCategory?.slug,
      canonical_url: cachedProduct.canonical_url,
    }),
    meta_title: cachedProduct.meta_title ?? undefined,
    meta_description: cachedProduct.meta_description ?? undefined,
    keywords: cachedProduct.keywords ?? undefined,
    // Use nullish coalescing so a legitimate `0` sale_price (free promo,
    // giveaway) is preserved rather than coerced up to base_price.
    price: cachedProduct.sale_price ?? cachedProduct.base_price,
    compare_at_price:
      cachedProduct.sale_price !== null &&
      cachedProduct.sale_price !== undefined
        ? cachedProduct.base_price
        : undefined,
    min_variant_price: cachedProduct.min_variant_price ?? undefined,
    max_variant_price: cachedProduct.max_variant_price ?? undefined,
    manage_stock: cachedProduct.track_quantity ?? false,
    stock: cachedProduct.quantity ?? 0,
    image: firstImage,
    imageLarge: firstImage,
    imageHint: cachedProduct.name,
    images: normalizedImages,
    brand: '',
    gtin: '',
    mpn: '',
    category: primaryCategory?.name || undefined,
    category_slug: primaryCategory?.slug || undefined,
    has_variants: normalizedVariants.length > 0,
    variants: normalizedVariants,
    specifications: cachedProduct.specifications as Product['specifications'],
    product_key_specs: normalizeProductKeySpecs(
      cachedProduct.product_key_specs
    ) as Product['product_key_specs'],
  };
}
