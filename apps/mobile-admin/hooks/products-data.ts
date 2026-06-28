import { MOBILE_ADMIN_PRODUCT_COLUMNS as PRODUCT_COLUMNS } from '@baci/shared';
import { normalizeProductInventory } from '@/lib/product-inventory';
import type {
  AdminProductSearchFilters,
  AdminProductStockFilter,
} from '@/lib/product-search';
import { fetchAdminProductSearchRows } from '@/lib/product-search';
import { supabase } from '@/lib/supabase';
import type { Product, ProductStatus, ProductsPage } from './products.types';

const PAGE_SIZE = 20;
const EFFECTIVE_IN_STOCK_FILTER =
  'stock_quantity.gt.0,and(stock_quantity.is.null,stock.gt.0),and(stock_quantity.lte.0,stock.gt.0)';
const EFFECTIVE_LOW_STOCK_FILTER =
  'and(stock_quantity.gt.0,stock_quantity.lte.5),and(stock_quantity.is.null,stock.gt.0,stock.lte.5),and(stock_quantity.lte.0,stock.gt.0,stock.lte.5)';
const EFFECTIVE_OUT_OF_STOCK_FILTER =
  'and(stock_quantity.is.null,stock.is.null),and(stock_quantity.is.null,stock.lte.0),and(stock_quantity.lte.0,stock.is.null),and(stock_quantity.lte.0,stock.lte.0)';

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

  if (filters?.stockFilter === 'out_of_stock') {
    query = query.eq('manage_stock', true).or(EFFECTIVE_OUT_OF_STOCK_FILTER);
  } else if (filters?.stockFilter === 'low_stock') {
    query = query.eq('manage_stock', true).or(EFFECTIVE_LOW_STOCK_FILTER);
  } else if (filters?.stockFilter === 'in_stock') {
    query = query.eq('manage_stock', true).or(EFFECTIVE_IN_STOCK_FILTER);
  }

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
  return normalizeProductInventory(data);
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
  return normalizeProductInventory(data);
}

export type { AdminProductStockFilter };
