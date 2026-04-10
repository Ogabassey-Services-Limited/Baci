/**
 * useProducts Hook
 * Fetches products with infinite scroll, search, and mutations
 */

import {
  MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY,
  normalizeProductSearchText,
  MOBILE_ADMIN_PRODUCT_COLUMNS as PRODUCT_COLUMNS,
} from '@baci/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { AnalyticsDateRange } from '@/lib/analytics-period';
import { normalizeProductInventory } from '@/lib/product-inventory';
import {
  type AdminProductSearchFilters,
  type AdminProductStatus,
  type AdminProductStockFilter,
  fetchAdminProductSearchRows,
  fetchAdminProductSuggestionCandidates,
} from '@/lib/product-search';
import { sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { getJoinedRecord } from '@/lib/supabase-utils';
import { useMerchant } from './useMerchant';

export type ProductStatus = AdminProductStatus;

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  stock: number;
  sku: string | null;
  slug: string;
  images: string[];
  status: ProductStatus;
  category: string | null;
  category_id: string | null;
  brand: string | null;
  brand_id: string | null;
  fulfillment_details: {
    items?: Array<{ imei: string; serial_number: string }>;
    [key: string]: unknown;
  } | null;
  color: string | null;
  condition: string | null;
  variant_attributes: Record<string, unknown> | null;
  has_variants: boolean;
  manage_stock: boolean;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryStats {
  inventoryValue: number;
  inventoryCost: number;
  totalStock: number;
  totalProducts: number;
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
}

interface ProductsPage {
  products: Product[];
  nextCursor: number | null;
  totalCount: number;
}

const PAGE_SIZE = 20;
const DUPLICATE_PRODUCT_ERROR = 'A product with this name already exists.';

function toProductSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isDuplicateConstraintError(error: { code?: string; message: string }) {
  return (
    error.code === '23505' || error.message.toLowerCase().includes('duplicate')
  );
}

async function assertNoDuplicateProduct(args: {
  merchantId: string;
  productName: string;
  excludeProductId?: string;
}) {
  const normalizedName = args.productName.trim();
  const normalizedSlug = toProductSlug(normalizedName);

  // Check exact name match (case-insensitive) and slug match
  let nameQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', args.merchantId)
    .ilike('name', normalizedName);

  let slugQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', args.merchantId)
    .eq('slug', normalizedSlug);

  if (args.excludeProductId) {
    nameQuery = nameQuery.neq('id', args.excludeProductId);
    slugQuery = slugQuery.neq('id', args.excludeProductId);
  }

  const [
    { count: nameMatches, error: nameError },
    { count: slugMatches, error: slugError },
    similarProducts,
  ] = await Promise.all([
    nameQuery,
    slugQuery,
    fetchAdminProductSuggestionCandidates<{ id: string; name: string }>({
      excludeProductId: args.excludeProductId,
      limit: 5,
      merchantId: args.merchantId,
      productName: normalizedName,
      selectColumns: 'id, name',
    }),
  ]);

  if (nameError) throw new Error(nameError.message);
  if (slugError) throw new Error(slugError.message);

  if ((nameMatches ?? 0) > 0 || (slugMatches ?? 0) > 0) {
    throw new Error(DUPLICATE_PRODUCT_ERROR);
  }

  // Shared ranked search catches compact model variants like "ProMax".
  if (similarProducts.length > 0) {
    const normalizedSearchName = normalizeProductSearchText(normalizedName);
    const match = similarProducts.find((product) => {
      return normalizeProductSearchText(product.name) === normalizedSearchName;
    });
    if (match) {
      throw new Error(`A similar product "${match.name}" already exists.`);
    }
  }
}

export type StockFilter = AdminProductStockFilter;

async function fetchProducts(
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
    .is('parent_product_id', null) // Only parent products
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.category) {
    query = query.eq('category_id', filters.category);
  }

  // Server-side stock filtering to avoid loading all products client-side
  if (filters?.stockFilter === 'out_of_stock') {
    query = query.eq('manage_stock', true).lte('stock_quantity', 0);
  } else if (filters?.stockFilter === 'low_stock') {
    query = query
      .eq('manage_stock', true)
      .gt('stock_quantity', 0)
      .lte('stock_quantity', 5);
  } else if (filters?.stockFilter === 'in_stock') {
    query = query.or('manage_stock.eq.false,stock_quantity.gt.5');
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;

  return {
    products: (data ?? []).map((product) => normalizeProductInventory(product)),
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    totalCount: count ?? 0,
  };
}

async function updateProductStock(
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

async function updateProductStatus(
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

export function useProducts(filters?: {
  status?: ProductStatus;
  search?: string;
  category?: string;
  stockFilter?: StockFilter;
}) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['products', merchantId, filters],
    queryFn: ({ pageParam = 0 }) => {
      if (!merchantId) {
        throw new Error('No merchant');
      }

      return fetchProducts(merchantId, pageParam, filters);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: filters?.search ? undefined : keepPreviousData,
  });
}

export function useProduct(productId: string) {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId || productId === 'new') return null;
      if (!merchant?.id) throw new Error('No merchant');

      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY)
        .eq('id', productId)
        .eq('merchant_id', merchant.id)
        .single();

      if (productError) throw productError;

      // Fetch variants if this is a parent or has_variants is true
      const { data: variants, error: variantsError } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('parent_product_id', productId)
        .eq('merchant_id', merchant.id); // Ensure variants also belong to the merchant

      if (variantsError && variantsError.code !== 'PGRST116') {
        // PGRST116 is "No rows found"
        if (__DEV__) {
          console.log('Error fetching variants', variantsError);
        }
      }

      const withRelations = productData as Product & {
        categories?: { name: string } | Array<{ name: string }> | null;
        brands?: { name: string } | Array<{ name: string }> | null;
      };
      const category = getJoinedRecord(withRelations.categories);
      const brand = getJoinedRecord(withRelations.brands);

      return {
        ...normalizeProductInventory(withRelations),
        categories: category ? { name: category.name } : undefined,
        brands: brand ? { name: brand.name } : undefined,
        variants: ((variants as Product[] | null) ?? []).map((variant) =>
          normalizeProductInventory(variant)
        ),
      } as Product & {
        categories?: { name: string };
        brands?: { name: string };
        variants: Product[];
      };
    },
    enabled: !!productId && productId !== 'new' && !!merchant?.id,
  });
}

import {
  ProductDbSchema,
  type ProductFormValues,
} from '@/lib/validators/product';

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['updateProduct'],
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ProductFormValues;
    }) => {
      if (!merchant?.id) throw new Error('No merchant');

      // 1. Validate & Transform (Client-side validation)
      // We perform the parse here to ensure the data matches our schema before transform
      const dbPayload = ProductDbSchema.parse(updates);

      await assertNoDuplicateProduct({
        merchantId: merchant.id,
        productName: dbPayload.name,
        excludeProductId: id,
      });

      const { data, error } = await supabase
        .from('products')
        .update({
          ...dbPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('merchant_id', merchant.id)
        .select(PRODUCT_COLUMNS)
        .single();

      if (error) {
        if (isDuplicateConstraintError(error)) {
          throw new Error(DUPLICATE_PRODUCT_ERROR);
        }
        throw new Error(error.message);
      }
      return normalizeProductInventory(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['createProduct'],
    mutationFn: async (newProduct: ProductFormValues) => {
      if (!merchant?.id) throw new Error('No merchant');

      // 1. Validate & Transform
      const dbPayload = ProductDbSchema.parse(newProduct);

      await assertNoDuplicateProduct({
        merchantId: merchant.id,
        productName: dbPayload.name,
      });

      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            ...dbPayload,
            merchant_id: merchant.id,
          },
        ])
        .select(PRODUCT_COLUMNS)
        .single();

      if (error) {
        if (isDuplicateConstraintError(error)) {
          throw new Error(DUPLICATE_PRODUCT_ERROR);
        }
        throw new Error(error.message);
      }
      return normalizeProductInventory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProductStock() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['updateProductStock'],
    mutationFn: ({
      productId,
      stock,
    }: {
      productId: string;
      stock: number;
    }) => {
      if (!merchant?.id) throw new Error('No merchant');
      return updateProductStock(productId, stock, merchant.id);
    },
    onMutate: async ({ productId, stock }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });

      const previousQueriesData: Array<{
        queryKey: readonly unknown[];
        data: unknown;
      }> = [];

      queryClient
        .getQueriesData({ queryKey: ['products'] })
        .forEach(([queryKey, data]) => {
          previousQueriesData.push({ queryKey, data });
        });

      queryClient.setQueriesData<{ pages: ProductsPage[] } | undefined>(
        { queryKey: ['products'] },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: ProductsPage) => ({
              ...page,
              products: page.products.map((product: Product) =>
                product.id === productId
                  ? { ...product, stock, stock_quantity: stock }
                  : product
              ),
            })),
          };
        }
      );

      return { previousQueriesData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueriesData) {
        for (const { queryKey, data } of context.previousQueriesData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['updateProductStatus'],
    mutationFn: ({
      productId,
      status,
    }: {
      productId: string;
      status: ProductStatus;
    }) => {
      if (!merchant?.id) throw new Error('No merchant');
      return updateProductStatus(productId, status, merchant.id);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products', merchant?.id] });
    },
  });
}

export function useCategories() {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['categories', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('merchant_id', merchant?.id)
        .order('name');

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!merchant?.id,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['createCategory'],
    mutationFn: async (name: string) => {
      if (!merchant?.id) throw new Error('No merchant');

      // Sanitize category name to prevent XSS
      const sanitizedName = sanitizeText(name, 200);
      if (!sanitizedName.trim()) throw new Error('Category name is required');
      const slug = sanitizedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data, error } = await supabase
        .from('categories')
        .insert([{ name: sanitizedName, slug, merchant_id: merchant.id }])
        .select('id, name, slug')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

interface TopProductRpcResult {
  id: string;
  name: string;
  revenue: number;
  units: number;
}

export interface TopSellingProduct extends Product {
  totalSold: number;
  totalRevenue: number;
}

// Stable sentinels for the "all time" fallback so the query key and the
// actual RPC parameters stay in sync when no range is provided.
const ALL_TIME_START_ISO = new Date(0).toISOString();
const ALL_TIME_END_ISO = new Date(
  Date.UTC(9999, 11, 31, 23, 59, 59, 999)
).toISOString();

export function useTopSellingProducts(
  limit: number = 20,
  range?: AnalyticsDateRange
) {
  const { merchant } = useMerchant();
  const startDate = range?.startDate
    ? range.startDate.toISOString()
    : ALL_TIME_START_ISO;
  const endDate = range?.endDate
    ? range.endDate.toISOString()
    : ALL_TIME_END_ISO;

  return useQuery({
    queryKey: ['top-selling-products', merchant?.id, limit, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_products', {
        p_merchant_id: merchant?.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: limit,
      });

      if (error) throw error;

      // Transform RPC result to match TopSellingProduct interface
      // RPC returns { id, name, revenue, units }
      // We need to fetch full product details or map accordingly.
      // Ideally RPC should return full details, but for now we can map partial product.
      // Or we can fetch product details for these IDs.
      // But for speed, let's just return what we have and maybe fetch images?

      // Wait, the UI expects full Product object + totalSold/Revenue.
      // The RPC `get_top_products` returns `id`, `name`, `revenue`, `units`.
      // It DOES NOT return price, images, stock etc.
      // So detailed view might break.

      // Let's modify the RPC later to return more info, OR fetch product details here.
      // Fetching details for 20 products is much faster than fetching 10,000 order items.

      const rpcData = data as TopProductRpcResult[];
      if (!rpcData?.length) return [];

      const productIds = rpcData.map((d) => d.id);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .in('id', productIds)
        .eq('merchant_id', merchant?.id);

      if (productsError) throw productsError;

      const productsMap = new Map(productsData?.map((p) => [p.id, p]));

      return rpcData
        .map((item) => {
          const product = productsMap.get(item.id);
          if (!product) return null;
          return {
            ...normalizeProductInventory(product),
            totalSold: Number(item.units),
            totalRevenue: Number(item.revenue),
          };
        })
        .filter(Boolean) as TopSellingProduct[];
    },
    enabled: !!merchant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes — analytics data doesn't change rapidly
    placeholderData: keepPreviousData,
  });
}

export function useInventoryStats() {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    queryKey: ['inventory-stats', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_merchant_inventory_stats',
        {
          p_merchant_id: merchantId,
        }
      );

      if (error) throw error;
      const rpcStats = (data ?? {}) as Partial<InventoryStats>;
      return {
        ...rpcStats,
        totalProducts: Number(rpcStats.totalProducts || 0),
        totalStock: Number(rpcStats.totalStock || 0),
        activeCount: Number(rpcStats.activeCount || 0),
        lowStockCount: Number(rpcStats.lowStockCount || 0),
        outOfStockCount: Number(rpcStats.outOfStockCount || 0),
        categoryCount: Number(rpcStats.categoryCount || 0),
        inventoryValue: Number(rpcStats.inventoryValue || 0),
        inventoryCost: Number(rpcStats.inventoryCost || 0),
      } satisfies InventoryStats;
    },
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: keepPreviousData,
  });
}
