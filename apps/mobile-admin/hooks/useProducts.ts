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
  has_variants: boolean;
  manage_stock: boolean;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
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
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), brands(name)')
        .eq('id', productId)
        .eq('merchant_id', merchant?.id)
        .single();

      if (error) throw new Error(error.message);
      return data as Product & { categories?: { name: string }; brands?: { name: string } };
    },
    enabled: !!productId && !!merchant?.id,
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
