/**
 * useProducts Hook
 * Fetches products with infinite scroll, search, and mutations
 */

import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
  fulfillment_details: { items?: Array<{ imei: string; serial_number: string }>;[key: string]: any } | null;
  color: string | null;
  variant_attributes: Record<string, any> | null;
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
  outOfStockCount: number;
  categoryCount: number;
}

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
    .select('*', { count: 'exact' })
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
    query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
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
  stock: number
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ stock, stock_quantity: stock, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function updateProductStatus(
  productId: string,
  status: ProductStatus
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export function useProducts(filters?: { status?: ProductStatus; search?: string; category?: string }) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['products', merchantId, filters],
    queryFn: ({ pageParam = 0 }) => fetchProducts(merchantId!, pageParam, filters),
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

      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*, categories(name), brands(name)')
        .eq('id', productId)
        .eq('merchant_id', merchant?.id)
        .single();

      if (productError) throw productError;

      // Fetch variants if this is a parent or has_variants is true
      const { data: variants, error: variantsError } = await supabase
        .from('products')
        .select('*')
        .eq('parent_product_id', productId)
        .eq('merchant_id', merchant?.id); // Ensure variants also belong to the merchant

      if (variantsError && variantsError.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.log('Error fetching variants', variantsError);
      }

      return { ...productData, variants: variants || [] } as Product & { categories?: { name: string }; brands?: { name: string }; variants: Product[] };
    },
    enabled: !!productId && productId !== 'new' && !!merchant?.id,
  });
}

import { ProductDbSchema, type ProductFormValues } from '@/lib/validators/product';

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ProductFormValues }) => {
      // 1. Validate & Transform (Client-side validation)
      // We perform the parse here to ensure the data matches our schema before transform
      const dbPayload = ProductDbSchema.parse(updates);

      const { data, error } = await supabase
        .from('products')
        .update({
          ...dbPayload,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
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
    mutationFn: async (newProduct: ProductFormValues) => {
      // 1. Validate & Transform
      const dbPayload = ProductDbSchema.parse(newProduct);

      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...dbPayload,
          merchant_id: merchant?.id,
        }])
        .select()
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
    mutationFn: ({ productId, stock }: { productId: string; stock: number }) =>
      updateProductStock(productId, stock),
    onMutate: async ({ productId, stock }) => {
      await queryClient.cancelQueries({ queryKey: ['products', merchant?.id] });

      const previousProducts = queryClient.getQueryData(['products', merchant?.id]);

      queryClient.setQueryData(['products', merchant?.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: ProductsPage) => ({
            ...page,
            products: page.products.map((product: Product) =>
              product.id === productId ? { ...product, stock, stock_quantity: stock } : product
            ),
          })),
        };
      });

      return { previousProducts };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products', merchant?.id], context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products', merchant?.id] });
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: ({ productId, status }: { productId: string; status: ProductStatus }) =>
      updateProductStatus(productId, status),
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
    mutationFn: async (name: string) => {
      if (!name.trim()) throw new Error('Category name is required');
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const { data, error } = await supabase
        .from('categories')
        .insert([{ name, slug, merchant_id: merchant?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
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
      // Manual aggregation for now (fallback logic from dashboard)
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price,
          product_id,
          products!inner(*)
        `)
        .eq('orders.merchant_id', merchant?.id);

      if (error) throw error;
      if (!orderItems) return [];

      const productMap = new Map<string, TopSellingProduct>();

      for (const item of orderItems) {
        // @ts-ignore - Supabase types join
        const product = item.products as Product;
        const existing = productMap.get(product.id);
        const qty = item.quantity || 1;
        const rev = qty * (item.price || 0);

        if (existing) {
          existing.totalSold += qty;
          existing.totalRevenue += rev;
        } else {
          productMap.set(product.id, {
            ...product,
            totalSold: qty,
            totalRevenue: rev,
          });
        }
      }

      return Array.from(productMap.values())
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, limit);
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
      const { data, error } = await supabase.rpc('get_merchant_inventory_stats', {
        p_merchant_id: merchantId,
      });

      if (error) throw error;
      return data as InventoryStats;
    },
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
