'use client';

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { ProductsResult } from '@/lib/products-server';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProductStats {
  inventoryValue: number;
  outOfStockCount: number;
  categoryCount: number;
}

type ToastApi = (args: {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}) => unknown;

interface UseProductFetchArgs<TProduct> {
  authLoading: boolean;
  user: { id: string } | null | undefined;
  initialData?: ProductsResult;
  pagination: PaginationInfo;
  migrationFilter: string;
  searchTerm: string;
  statusFilter: string;
  stockFilter: string;
  setProducts: Dispatch<SetStateAction<TProduct[]>>;
  setPagination: Dispatch<SetStateAction<PaginationInfo>>;
  setStats: Dispatch<SetStateAction<ProductStats>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  toast: ToastApi;
}

type LatestFetchState<TProduct> = UseProductFetchArgs<TProduct>;

export function useProductFetch<TProduct>({
  authLoading,
  user,
  initialData,
  pagination,
  migrationFilter,
  searchTerm,
  statusFilter,
  stockFilter,
  setProducts,
  setPagination,
  setStats,
  setIsLoading,
  toast,
}: UseProductFetchArgs<TProduct>) {
  const fetchInProgressRef = useRef(false);
  const lastFetchParamsRef = useRef('');
  const lastFetchTimeRef = useRef(0);
  const isFirstRender = useRef(true);
  const latestFetchStateRef = useRef<LatestFetchState<TProduct>>({
    authLoading,
    user,
    initialData,
    pagination,
    migrationFilter,
    searchTerm,
    statusFilter,
    stockFilter,
    setProducts,
    setPagination,
    setStats,
    setIsLoading,
    toast,
  });
  const queryKey = [
    authLoading ? 'loading' : 'ready',
    user?.id ?? 'anonymous',
    pagination.page,
    pagination.limit,
    migrationFilter,
    searchTerm,
    statusFilter,
    stockFilter,
  ].join('|');

  useEffect(() => {
    latestFetchStateRef.current = {
      authLoading,
      user,
      initialData,
      pagination,
      migrationFilter,
      searchTerm,
      statusFilter,
      stockFilter,
      setProducts,
      setPagination,
      setStats,
      setIsLoading,
      toast,
    };
  }, [
    authLoading,
    user,
    initialData,
    pagination,
    migrationFilter,
    searchTerm,
    statusFilter,
    stockFilter,
    setProducts,
    setPagination,
    setStats,
    setIsLoading,
    toast,
  ]);

  const fetchProducts = async (force = false) => {
    const {
      authLoading: latestAuthLoading,
      user: latestUser,
      pagination: latestPagination,
      migrationFilter: latestMigrationFilter,
      searchTerm: latestSearchTerm,
      statusFilter: latestStatusFilter,
      stockFilter: latestStockFilter,
      setProducts: latestSetProducts,
      setPagination: latestSetPagination,
      setStats: latestSetStats,
      setIsLoading: latestSetIsLoading,
      toast: latestToast,
    } = latestFetchStateRef.current;

    if (latestAuthLoading || !latestUser) {
      if (!latestAuthLoading && !latestUser) {
        latestSetProducts([]);
        latestSetIsLoading(false);
      }
      return;
    }

    const params = new URLSearchParams({
      page: latestPagination.page.toString(),
      limit: latestPagination.limit.toString(),
      migration: latestMigrationFilter,
      search: latestSearchTerm,
      status: latestStatusFilter,
      stock: latestStockFilter,
    });
    const paramsString = params.toString();

    const now = Date.now();
    const lastFetch = lastFetchTimeRef.current;
    if (!force && now - lastFetch < 1000) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Throttling product fetch');
      }
      return;
    }

    if (
      !force &&
      (fetchInProgressRef.current ||
        paramsString === lastFetchParamsRef.current)
    ) {
      return;
    }

    lastFetchTimeRef.current = now;
    fetchInProgressRef.current = true;
    lastFetchParamsRef.current = paramsString;
    latestSetIsLoading(true);

    try {
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        if ([401, 403, 404, 500, 429].includes(response.status)) {
          if (response.status === 429) {
            console.warn('Rate limit hit for products fetch; not retrying.');
          }
          fetchInProgressRef.current = false;
          latestSetIsLoading(false);
          return;
        }

        console.error(
          `Fetch failed with status: ${response.status} ${response.statusText}`
        );
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      latestSetProducts(data.products || []);
      latestSetPagination(data.pagination);
      latestSetStats(
        data.stats || {
          inventoryValue: 0,
          outOfStockCount: 0,
          categoryCount: 0,
        }
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      latestToast({
        title: 'Error',
        description: 'Failed to load products',
        variant: 'destructive',
      });
    } finally {
      fetchInProgressRef.current = false;
      latestSetIsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey intentionally drives refetch while fetchProducts reads current render state.
  useEffect(() => {
    if (initialData && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    void fetchProducts();
  }, [initialData, queryKey]);

  return { fetchProducts };
}
