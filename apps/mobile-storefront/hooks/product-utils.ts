import type { QueryClient } from '@tanstack/react-query';
import { withSupabaseRetry } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import {
  getPrimaryProductImage,
  normalizeProductImages,
  normalizeVariantAttributes,
} from '@/lib/product-normalization';
import { removeProductSlugFromProductsCache } from '@/lib/product-query-cache';
import { getProductSlugFallbackCandidates } from '@/lib/product-slug-fallback';
import { supabase } from '@/lib/supabase';
import { ProductRowSchema } from '@/lib/validation';
import type { Product } from '@/types/product';

const log = createLogger('Products');

export const MERCHANT_SLUG = CONFIG.MERCHANT_SLUG || 'ogabassey';
export const CONSTANT_MERCHANT_ID = CONFIG.MERCHANT_ID;

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  icon?: string;
}

export interface UseProductsOptions {
  category?: string;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  search?: string;
  condition?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  enabled?: boolean;
}

export interface ProductsPage {
  products: Product[];
  nextOffset: number | null;
  total: number;
}

export const PRODUCT_SELECT = `
  id, name, slug, description, price, compare_at_price,
  images, brand, condition, status, specifications,
  has_variants, variant_attributes, manage_stock, stock_quantity,
  categories (id, name, slug)
`;

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function fetchProductRow(
  merchantId: string,
  identifier: string,
  context: string
) {
  let supabaseQuery = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (isUuid(identifier)) {
    supabaseQuery = supabaseQuery.eq('id', identifier);
  } else {
    supabaseQuery = supabaseQuery.eq('slug', identifier);
  }

  return withSupabaseRetry(async () => await supabaseQuery.maybeSingle(), {
    maxRetries: 3,
    onRetry: (attempt, err) => {
      log.warn(`${context} retry ${attempt}: ${err.message}`);
    },
  });
}

export async function resolveProductRow(merchantId: string, slug: string) {
  const exact = await fetchProductRow(merchantId, slug, 'Product');
  if (exact.error) throw exact.error;
  if (exact.data) return exact.data;
  if (isUuid(slug)) return null;

  for (const fallbackSlug of getProductSlugFallbackCandidates(slug)) {
    const fallback = await fetchProductRow(
      merchantId,
      fallbackSlug,
      'Product fallback'
    );
    if (fallback.error) throw fallback.error;
    if (fallback.data) {
      log.warn(`Resolved legacy product slug "${slug}" to "${fallbackSlug}"`);
      return fallback.data;
    }
  }

  return null;
}

export async function resolveAndEvictProduct(
  merchantId: string,
  slug: string,
  queryClient: QueryClient
) {
  const data = await resolveProductRow(merchantId, slug);
  if (data) {
    return data;
  }

  queryClient.setQueriesData(
    { queryKey: ['products', merchantId], exact: false },
    (cached) => removeProductSlugFromProductsCache(cached, slug)
  );

  throw new Error(
    'This product is no longer available. Refresh the app to remove outdated product cards.'
  );
}

export function transformProduct(item: unknown): Product {
  const validated = ProductRowSchema.safeParse(item);
  if (!validated.success) {
    log.error('Product row validation failed during transform', {
      issues: validated.error.format(),
      item,
    });
  }
  const product = validated.success
    ? validated.data
    : (item as Record<string, unknown>);
  const images = normalizeProductImages(product.images);

  return {
    id: String(product.id ?? ''),
    name: String(product.name ?? ''),
    slug: String(product.slug ?? ''),
    description: product.description as string | undefined,
    price: Number(product.price ?? 0),
    compare_at_price: product.compare_at_price as number | undefined,
    image: getPrimaryProductImage(product.images),
    images,
    brand: product.brand as string | undefined,
    category: Array.isArray(product.categories)
      ? product.categories.length > 0
        ? (product.categories[0] as Category).name
        : ''
      : product.categories != null
        ? (product.categories as unknown as Category).name
        : '',
    condition: product.condition as Product['condition'],
    rating: 4.5,
    review_count: 0,
    manage_stock: (product.manage_stock as boolean) ?? false,
    in_stock:
      !(product.manage_stock as boolean) ||
      ((product.stock_quantity as number) ?? 0) > 0,
  };
}

export async function fetchProductsPage(
  merchantId: string,
  options: UseProductsOptions,
  offset: number
): Promise<ProductsPage> {
  const limit = options.limit || 20;

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (options.category) {
    query = query.eq('category_id', options.category);
  }
  if (options.search) {
    const escapedSearch = options.search
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    query = query.ilike('name', `%${escapedSearch}%`);
  }
  if (options.condition) {
    query = query.eq('condition', options.condition);
  }
  if (options.brand) {
    query = query.eq('brand', options.brand);
  }
  if (options.minPrice !== undefined) {
    query = query.gte('price', options.minPrice);
  }
  if (options.maxPrice !== undefined) {
    query = query.lte('price', options.maxPrice);
  }
  if (options.minRating !== undefined && options.minRating > 0) {
    query = query.gte('average_rating', options.minRating);
  }

  switch (options.sortBy) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'popular':
      query = query.order('view_count', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const result = await withSupabaseRetry(async () => await query, {
    maxRetries: 3,
    onRetry: (attempt, err) => {
      log.warn(`Retry ${attempt}: ${err.message}`);
    },
  });

  if (result.error) throw result.error;

  const products = (result.data || []).map(transformProduct);
  const resultWithCount = result as typeof result & { count: number | null };
  const total = resultWithCount.count ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return { products, nextOffset, total };
}

export { log, normalizeVariantAttributes };
