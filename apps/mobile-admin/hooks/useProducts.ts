import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import type {
  AdminProductSearchFilters,
  AdminProductStockFilter,
} from '@/lib/product-search';
import { supabase } from '@/lib/supabase';
import type { ProductFormValues } from '@/lib/validators/product';
import { fetchProductDetail } from './product-detail-query';
import { createProductRecord, updateProductRecord } from './product-save';
import type {
  InventoryStats,
  Product,
  ProductStatus,
  ProductsPage,
} from './products.types';
import {
  fetchProducts,
  updateProductStatus,
  updateProductStock,
} from './products-data';
import {
  buildUpdateProductArgs,
  type UpdateProductVariables,
} from './update-product-args';
import { useMerchant } from './useMerchant';

export type StockFilter = AdminProductStockFilter;
export type { InventoryStats, Product, ProductStatus, ProductsPage };

export function useProducts(filters?: AdminProductSearchFilters) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery<ProductsPage, Error>({
    enabled: !!merchantId,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    placeholderData: filters?.search ? undefined : keepPreviousData,
    queryFn: ({ pageParam = 0 }) => {
      if (!merchantId) throw new Error('No merchant');
      return fetchProducts(merchantId, pageParam as number, filters);
    },
    queryKey: ['products', merchantId, filters],
    staleTime: 1000 * 60 * 2,
  });
}

export function useProduct(productId: string) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    enabled: !!productId && productId !== 'new' && !!merchantId,
    queryFn: () => {
      if (!productId || productId === 'new') return null;
      if (!merchantId) throw new Error('No merchant');
      return fetchProductDetail({ merchantId, productId });
    },
    queryKey: ['product', merchantId, productId],
    staleTime: 1000 * 30,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation<Product, Error, UpdateProductVariables>({
    mutationFn: (variables: UpdateProductVariables) => {
      if (!merchant?.id) throw new Error('No merchant');
      return updateProductRecord(
        buildUpdateProductArgs(merchant.id, variables)
      );
    },
    mutationKey: ['updateProduct'],
    onSuccess: async (data, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: ['product', merchant?.id, data.id],
        }),
        queryClient.invalidateQueries({ queryKey: ['products', merchant?.id] }),
      ];
      if (merchant?.id && variables.updates.status !== undefined) {
        invalidations.push(invalidateStoreReadiness(queryClient, merchant.id));
      }
      await Promise.all(invalidations);
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation<Product, Error, ProductFormValues>({
    mutationFn: (newProduct: ProductFormValues) => {
      if (!merchant?.id) throw new Error('No merchant');
      return createProductRecord({ merchantId: merchant.id, newProduct });
    },
    mutationKey: ['createProduct'],
    onSuccess: async (data) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['products', merchant?.id] }),
      ];
      if (merchant?.id && data.status === 'active') {
        invalidations.push(invalidateStoreReadiness(queryClient, merchant.id));
      }
      await Promise.all(invalidations);
    },
  });
}

export function useUpdateProductStock() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation<
    Product,
    Error,
    { productId: string; stock: number },
    {
      previousQueriesData: Array<{
        queryKey: readonly unknown[];
        data: unknown;
      }>;
    }
  >({
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
    mutationKey: ['updateProductStock'],
    onError: (_err, _vars, context) => {
      if (context?.previousQueriesData) {
        for (const { queryKey, data } of context.previousQueriesData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
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
          previousQueriesData.push({ data, queryKey });
        });

      queryClient.setQueriesData<{ pages: ProductsPage[] } | undefined>(
        { queryKey: ['products'] },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              products: page.products.map((product) =>
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
    onSettled: async (_data, _error, { productId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products', merchant?.id] }),
        queryClient.invalidateQueries({
          queryKey: ['product', merchant?.id, productId],
        }),
      ]);
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
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
    mutationKey: ['updateProductStatus'],
    onSuccess: async (_data, { productId }) => {
      if (!merchant?.id) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products', merchant.id] }),
        queryClient.invalidateQueries({
          queryKey: ['product', merchant.id, productId],
        }),
        invalidateStoreReadiness(queryClient, merchant.id),
      ]);
    },
  });
}

export { useCategories } from './useCategories';
export { useCreateCategory } from './useCreateCategory';

export function useInventoryStats() {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    enabled: !!merchantId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_merchant_inventory_stats',
        { p_merchant_id: merchantId }
      );
      if (error) throw error;
      const rpcStats = (data ?? {}) as Partial<InventoryStats>;
      return {
        activeCount: Number(rpcStats.activeCount || 0),
        categoryCount: Number(rpcStats.categoryCount || 0),
        inventoryCost: Number(rpcStats.inventoryCost || 0),
        inventoryValue: Number(rpcStats.inventoryValue || 0),
        lowStockCount: Number(rpcStats.lowStockCount || 0),
        outOfStockCount: Number(rpcStats.outOfStockCount || 0),
        totalProducts: Number(rpcStats.totalProducts || 0),
        totalStock: Number(rpcStats.totalStock || 0),
      } satisfies InventoryStats;
    },
    queryKey: ['inventory-stats', merchantId],
    staleTime: 1000 * 60 * 5,
  });
}
