import { normalizeProductKeySpecs } from '@/lib/product-key-specs-normalize';
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { generateSlug } from '@/lib/seo-utils';
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';
import {
  getMappedCanonicalUrl,
  normalizeProductImages,
  type RawProductImage,
  type StorefrontProductVariants,
} from './product-mappers';

export interface DetailedCachedProduct {
  id: string;
  merchant_id?: string | null;
  name: string;
  description?: string | null;
  status?: string | null;
  slug?: string | null;
  canonical_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  keywords?: string[] | null;
  schema_markup?: Product['schema_markup'] | null;
  google_product_category?: string | null;
  condition?: string | null;
  condition_detail?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  min_variant_price?: number | null;
  max_variant_price?: number | null;
  manage_stock?: boolean | null;
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  images?: RawProductImage[] | null;
  imageHint?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  category?: string | null;
  categories?:
    | {
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
      }>
    | null;
  product_variants?: StorefrontProductVariants;
  specifications?: unknown;
  product_key_specs?: unknown;
  has_condition_offers?: boolean | null;
  variant_model?: 'legacy' | 'sku_matrix' | null;
  available_conditions?: string[] | null;
  offers?:
    | {
        id: string;
        condition: 'new' | 'used' | 'open_box' | 'refurbished';
        price: number;
        stock_quantity: number;
        images?: string[];
      }[]
    | null;
}

export function mapDetailedCachedProductToProduct(
  detailedProduct: DetailedCachedProduct,
  merchantId: string
): Product {
  const rawPrimaryCategory = detailedProduct.categories;
  const primaryCategory = Array.isArray(rawPrimaryCategory)
    ? rawPrimaryCategory[0]
    : rawPrimaryCategory;
  const normalizedImages = normalizeProductImages(
    detailedProduct.name,
    detailedProduct.images
  );
  const firstImage = normalizedImages?.[0]?.url || '';
  const normalizedVariants = normalizeStorefrontProductVariants(
    detailedProduct.product_variants,
    {
      merchantId: detailedProduct.merchant_id || merchantId,
      productId: detailedProduct.id,
    }
  );
  const categoryName = primaryCategory?.name || detailedProduct.category;
  const categorySlug =
    primaryCategory?.slug ||
    (detailedProduct.category
      ? generateSlug(detailedProduct.category)
      : undefined);

  return {
    id: detailedProduct.id,
    merchant_id: detailedProduct.merchant_id || merchantId,
    name: detailedProduct.name,
    description: detailedProduct.description || '',
    status: (detailedProduct.status || 'active') as
      | 'draft'
      | 'active'
      | 'archived',
    slug: detailedProduct.slug || detailedProduct.id,
    canonical_url: getMappedCanonicalUrl({
      id: detailedProduct.id,
      name: detailedProduct.name,
      slug: detailedProduct.slug,
      category: categoryName,
      category_slug: categorySlug,
      canonical_url: detailedProduct.canonical_url,
      condition: detailedProduct.condition,
      condition_detail: detailedProduct.condition_detail,
    }),
    meta_title: detailedProduct.meta_title ?? undefined,
    meta_description: detailedProduct.meta_description ?? undefined,
    keywords: detailedProduct.keywords ?? undefined,
    schema_markup: detailedProduct.schema_markup ?? undefined,
    google_product_category:
      detailedProduct.google_product_category ?? undefined,
    price:
      typeof detailedProduct.price === 'string'
        ? Number.parseFloat(detailedProduct.price) || 0
        : detailedProduct.price || 0,
    compare_at_price:
      typeof detailedProduct.compare_at_price === 'string'
        ? Number.parseFloat(detailedProduct.compare_at_price) || undefined
        : detailedProduct.compare_at_price || undefined,
    min_variant_price: detailedProduct.min_variant_price ?? undefined,
    max_variant_price: detailedProduct.max_variant_price ?? undefined,
    manage_stock: detailedProduct.manage_stock ?? false,
    stock: getEffectiveStock(detailedProduct),
    image: firstImage,
    imageLarge: firstImage,
    imageHint: detailedProduct.imageHint || detailedProduct.name,
    images: normalizedImages,
    brand: detailedProduct.brand || '',
    gtin: detailedProduct.gtin || '',
    mpn: detailedProduct.mpn || '',
    category: categoryName || undefined,
    category_slug: categorySlug || undefined,
    categories: primaryCategory
      ? {
          id: primaryCategory.id,
          name: primaryCategory.name,
          slug: primaryCategory.slug,
          parent_id: primaryCategory.parent_id ?? undefined,
        }
      : null,
    has_variants: normalizedVariants.length > 0,
    has_condition_offers: detailedProduct.has_condition_offers ?? false,
    variant_model:
      detailedProduct.variant_model === 'sku_matrix' ? 'sku_matrix' : 'legacy',
    available_conditions:
      Array.isArray(detailedProduct.available_conditions) &&
      detailedProduct.available_conditions.every(
        (value) => typeof value === 'string'
      )
        ? (detailedProduct.available_conditions as Product['available_conditions'])
        : undefined,
    offers: detailedProduct.offers ?? [],
    variants: normalizedVariants,
    specifications: detailedProduct.specifications as Product['specifications'],
    product_key_specs: normalizeProductKeySpecs(
      detailedProduct.product_key_specs
    ) as Product['product_key_specs'],
  } as Product;
}
