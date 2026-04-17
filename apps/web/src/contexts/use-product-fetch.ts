'use client';

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useEffectEvent,
  useRef,
} from 'react';
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

  const runFetchProducts = useEffectEvent(async (force = false) => {
    if (authLoading || !user) {
      if (!authLoading && !user) {
        setProducts([]);
        setIsLoading(false);
      }
      return;
    }

    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      migration: migrationFilter,
      search: searchTerm,
      status: statusFilter,
      stock: stockFilter,
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
    setIsLoading(true);

    try {
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        if ([401, 403, 404, 500, 429].includes(response.status)) {
          if (response.status === 429) {
            console.warn('Rate limit hit for products fetch; not retrying.');
          }
          fetchInProgressRef.current = false;
          setIsLoading(false);
          return;
        }

        console.error(
          `Fetch failed with status: ${response.status} ${response.statusText}`
        );
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      setProducts(data.products || []);
      setPagination(data.pagination);
      setStats(
        data.stats || {
          inventoryValue: 0,
          outOfStockCount: 0,
          categoryCount: 0,
        }
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products',
        variant: 'destructive',
      });
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  });

  const fetchProducts = async (force = false) => {
    await runFetchProducts(force);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey intentionally drives refetch while runFetchProducts reads the latest state via useEffectEvent.
  useEffect(() => {
    if (initialData && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    void runFetchProducts();
  }, [initialData, queryKey]);

  return { fetchProducts };
}
