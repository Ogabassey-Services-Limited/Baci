import { MOBILE_ADMIN_PRODUCT_COLUMNS as PRODUCT_COLUMNS } from '@baci/shared';
import { normalizeProductInventory } from '@/lib/product-inventory';
import type {
  AdminProductSearchFilters,
  AdminProductStockFilter,
} from '@/lib/product-search';
import {
  applyAdminProductStockFilter,
  fetchAdminProductSearchRows,
} from '@/lib/product-search';
import { revalidateStorefrontProducts } from '@/lib/revalidate-storefront-products';
import { supabase } from '@/lib/supabase';
import type { Product, ProductStatus, ProductsPage } from './products.types';

const PAGE_SIZE = 20;

export async function fetchProducts(
  merchantId: string,
  cursor: number = 0,
  filters?: AdminProductSearchFilters
): Promise<ProductsPage> {
  if (filters?.search) {
    const page = await fetchAdminProductSearchRows<Product>({
      cursor,
      filters,
      merchantId,
      pageSize: PAGE_SIZE,
      selectColumns: PRODUCT_COLUMNS,
    });

    return {
      nextCursor: page.nextCursor,
      products: page.rows.map((product) => normalizeProductInventory(product)),
      totalCount: page.totalCount,
    };
  }

  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS, { count: 'exact' })
    .eq('merchant_id', merchantId)
    .is('parent_product_id', null)
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.category) query = query.eq('category_id', filters.category);
  if (!filters?.status && filters?.stockFilter) {
    query = query.neq('status', 'archived');
  }
  query = applyAdminProductStockFilter(query, filters?.stockFilter);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;
  return {
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    products: (data ?? []).map((product) => normalizeProductInventory(product)),
    totalCount: count ?? 0,
  };
}

export async function updateProductStock(
  productId: string,
  stock: number,
  merchantId: string
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      stock,
      stock_quantity: stock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  const product = normalizeProductInventory(data);

  // The quick stock edit mutated the product via Supabase directly (no web
  // route ran), so nothing evicted the storefront's raised-TTL edge cache.
  // Fire-and-forget the SAME purge the save path uses (never awaited, never
  // throws) so the storefront reflects the new stock/availability immediately.
  void revalidateStorefrontProducts([
    { slug: product.slug, id: product.id, category: product.category },
  ]);

  return product;
}

export async function updateProductStatus(
  productId: string,
  status: ProductStatus,
  merchantId: string
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  const product = normalizeProductInventory(data);

  // A status flip (e.g. archive/activate) changes what the storefront lists and
  // serves, but was written straight to Supabase with no web route to evict the
  // raised-TTL edge cache. Fire-and-forget the same storefront purge the save
  // path uses (never awaited, never throws).
  void revalidateStorefrontProducts([
    { slug: product.slug, id: product.id, category: product.category },
  ]);

  return product;
}

export type { AdminProductStockFilter };
