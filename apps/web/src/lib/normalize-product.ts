/**
 * Unified Product Data Normalization
 *
 * This module provides a single source of truth for product data transformation.
 * All API routes and server components should use this to ensure consistent
 * Entity-Attribute-Value (EAV) output for SEO and frontend consumption.
 *
 * Koray Alignment:
 * - Ensures consistent EAV structure for better entity extraction
 * - Cleaner HTML = lower "understand" cost for crawlers
 * - Predictable structures improve SEO signal quality
 */

import { getEffectiveStock } from '@/lib/product-stock';
import { generateSlug } from '@/lib/seo-utils';

const PLACEHOLDER_IMAGE =
  'https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image';

type ProductKeySpecValue = string | number | boolean | undefined;

export type ProductKeySpecsRecord = Record<string, ProductKeySpecValue>;

/**
 * Raw product data as it comes from Supabase DB
 */
export interface RawDbProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  images?: (string | { url?: string; alt?: string; order?: number })[];
  categories?:
    | { id?: string; name: string; slug: string }
    | { id?: string; name: string; slug: string }[]
    | null;
  // Support for Many-to-Many relation (preferred over single category_id)
  product_categories?: {
    categories: { id?: string; name: string; slug: string } | null;
  }[];
  category?: string; // Legacy TEXT field
  category_id?: string;
  brand?: string;
  price: number;
  compare_at_price?: number;
  condition?: string;
  stock?: number;
  stock_quantity?: number;
  rating?: number;
  product_key_specs?: unknown;
  merchant_id?: string;
  status?: string;
  has_condition_offers?: boolean;
  available_conditions?: string[] | null;
  variant_model?: 'legacy' | 'sku_matrix' | null;
  // Allow additional fields
  [key: string]: unknown;
}

interface JoinedCategory {
  id?: string;
  name: string;
  slug: string;
}

interface NormalizeProductOptions {
  preferredCategorySlug?: string;
}

/**
 * Normalized product structure for frontend consumption
 */
export interface NormalizedProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  imageLarge: string;
  images: string[];
  category: string;
  category_slug: string;
  brand: string | null;
  price: number;
  compare_at_price: number | null;
  condition: string;
  stock: number;
  rating: number;
  availability: 'InStock' | 'OutOfStock';
  product_key_specs?: ProductKeySpecsRecord | null;
  merchant_id?: string;
  status?: string;
  has_condition_offers?: boolean;
  available_conditions: string[];
  variant_model: 'legacy' | 'sku_matrix';
  canonical_url?: string | null;
}

/**
 * Extracts the primary image URL from various image formats
 */
function extractPrimaryImage(
  images?: (string | { url?: string; alt?: string; order?: number })[]
): string {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return PLACEHOLDER_IMAGE;
  }

  const first = images[0];

  if (typeof first === 'string') {
    return first || PLACEHOLDER_IMAGE;
  }

  if (first && typeof first === 'object' && 'url' in first) {
    return first.url || PLACEHOLDER_IMAGE;
  }

  return PLACEHOLDER_IMAGE;
}

/**
 * Normalizes image array to string URLs
 */
function normalizeImages(
  images?: (string | { url?: string; alt?: string; order?: number })[]
): string[] {
  if (!images || !Array.isArray(images)) {
    return [];
  }

  return images
    .map((img) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && 'url' in img) return img.url;
      return null;
    })
    .filter((url): url is string => Boolean(url));
}

function getJoinedCategories(raw: RawDbProduct): JoinedCategory[] {
  const directCategories = Array.isArray(raw.categories)
    ? raw.categories
    : raw.categories
      ? [raw.categories]
      : [];
  const productCategories =
    raw.product_categories
      ?.map((entry) => entry.categories)
      .filter((category): category is JoinedCategory => Boolean(category)) ??
    [];
  const seenSlugs = new Set<string>();

  return [...directCategories, ...productCategories].filter((category) => {
    if (!category.slug || seenSlugs.has(category.slug)) {
      return false;
    }

    seenSlugs.add(category.slug);
    return true;
  });
}

function normalizeProductKeySpecs(
  value: unknown
): ProductKeySpecsRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => {
    return (
      typeof entryValue === 'string' ||
      typeof entryValue === 'number' ||
      typeof entryValue === 'boolean' ||
      typeof entryValue === 'undefined'
    );
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * Normalizes raw DB product data into a consistent structure
 *
 * @param raw - Raw product data from Supabase
 * @returns Normalized product with consistent structure
 *
 * @example
 * ```typescript
 * const { data: products } = await supabase.from('products').select('*, categories:category_id(...)');
 * const normalizedProducts = products.map(normalizeProduct);
 * ```
 */
export function normalizeProduct(
  raw: RawDbProduct,
  options: NormalizeProductOptions = {}
): NormalizedProduct {
  const primaryImage = extractPrimaryImage(raw.images);
  const normalizedImages = normalizeImages(raw.images);
  const joinedCategories = getJoinedCategories(raw);
  const joinedCategory =
    (options.preferredCategorySlug
      ? joinedCategories.find(
          (category) => category.slug === options.preferredCategorySlug
        )
      : undefined) || joinedCategories[0];

  // Determine category name
  const categoryName = joinedCategory?.name || raw.category || 'General';

  // Determine category slug
  const categorySlug =
    joinedCategory?.slug ||
    (raw.category ? generateSlug(raw.category) : 'general');

  // Determine stock availability
  const stock = getEffectiveStock(raw);
  const availability: 'InStock' | 'OutOfStock' =
    stock > 0 ? 'InStock' : 'OutOfStock';

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug || raw.id,
    description: raw.description || '',
    image: primaryImage,
    imageLarge: primaryImage,
    images: normalizedImages.length > 0 ? normalizedImages : [primaryImage],
    category: categoryName,
    category_slug: categorySlug,
    brand: raw.brand || null,
    price: raw.price,
    compare_at_price: raw.compare_at_price ?? null,
    condition: raw.condition || 'New',
    stock,
    rating: raw.rating ?? 0,
    availability,
    product_key_specs: normalizeProductKeySpecs(raw.product_key_specs),
    merchant_id: raw.merchant_id,
    status: raw.status,
    has_condition_offers: raw.has_condition_offers ?? false,
    available_conditions:
      Array.isArray(raw.available_conditions) &&
      raw.available_conditions.every((value) => typeof value === 'string')
        ? raw.available_conditions
        : [],
    variant_model: raw.variant_model === 'sku_matrix' ? 'sku_matrix' : 'legacy',
    canonical_url:
      typeof raw.canonical_url === 'string' ? raw.canonical_url : null,
  };
}

/**
 * Normalizes an array of raw products
 *
 * @param products - Array of raw products from Supabase
 * @returns Array of normalized products
 */
export function normalizeProducts(
  products: RawDbProduct[]
): NormalizedProduct[] {
  return products.map((product) => normalizeProduct(product));
}
