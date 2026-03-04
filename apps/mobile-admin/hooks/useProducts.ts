/**
 * useProducts Hook
 * Fetches products with infinite scroll, search, and mutations
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { sanitizeSearchQuery, sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

export type ProductStatus = 'active' | 'draft' | 'archived';

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
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
}

const PRODUCT_COLUMNS =
  'id, name, description, price, compare_at_price, cost_price, stock_quantity, stock, sku, slug, images, status, category, category_id, brand, brand_id, fulfillment_details, color, variant_attributes, has_variants, manage_stock, low_stock_threshold, created_at, updated_at' as const;

interface ProductsPage {
  products: Product[];
  nextCursor: number | null;
  totalCount: number;
}

const PAGE_SIZE = 20;

async function fetchProducts(
  merchantId: string,
  cursor: number = 0,
  filters?: { status?: ProductStatus; search?: string; category?: string }
): Promise<ProductsPage> {
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

  if (filters?.search) {
    const term = sanitizeSearchQuery(filters.search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;

  return {
    products: data ?? [],
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
  return data;
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
  return data;
}

export function useProducts(filters?: {
  status?: ProductStatus;
  search?: string;
  category?: string;
}) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['products', merchantId, filters],
    queryFn: ({ pageParam = 0 }) =>
      fetchProducts(merchantId!, pageParam, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
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
        .select(`${PRODUCT_COLUMNS}, categories(name), brands(name)`)
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
      const category = Array.isArray(withRelations.categories)
        ? withRelations.categories[0]
        : withRelations.categories;
      const brand = Array.isArray(withRelations.brands)
        ? withRelations.brands[0]
        : withRelations.brands;

      return {
        ...withRelations,
        categories: category ? { name: category.name } : undefined,
        brands: brand ? { name: brand.name } : undefined,
        variants: (variants as Product[] | null) ?? [],
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
  const { merchant: _merchant } = useMerchant();

  return useMutation({
    mutationKey: ['updateProduct'],
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ProductFormValues;
    }) => {
      // 1. Validate & Transform (Client-side validation)
      // We perform the parse here to ensure the data matches our schema before transform
      const dbPayload = ProductDbSchema.parse(updates);

      const { data, error } = await supabase
        .from('products')
        .update({
          ...dbPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(PRODUCT_COLUMNS)
        .single();

      if (error) throw new Error(error.message);
      return data;
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

      if (error) throw new Error(error.message);
      return data;
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

export function useTopSellingProducts(limit: number = 20) {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['top-selling-products', merchant?.id, limit],
    queryFn: async () => {
      // 1970-01-01 to now (all time)
      const startDate = new Date(0).toISOString();
      const endDate = new Date().toISOString();

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
            ...product,
            totalSold: Number(item.units),
            totalRevenue: Number(item.revenue),
          };
        })
        .filter(Boolean) as TopSellingProduct[];
    },
    enabled: !!merchant?.id,
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
      return data as InventoryStats;
    },
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
