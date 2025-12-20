/**
 * React Query Client Configuration with MMKV Persistence
 *
 * 2025 Best Practice: "Flash-Load" Pattern
 * - Data displayed from MMKV cache within 50ms on app start
 * - Background refresh happens after cached data is shown
 * - 24-hour cache retention for offline resilience
 */

import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createMMKV } from 'react-native-mmkv';

// Initialize dedicated MMKV instance for query cache
// Separate from cart/auth storage for isolation
let queryStorage: ReturnType<typeof createMMKV> | null = null;

export const getQueryStorage = () => {
  if (!queryStorage) {
    queryStorage = createMMKV({ id: 'ogabassey-query-cache' });
  }
  return queryStorage;
};

// Create a synchronous storage adapter for React Query
// MMKV is synchronous by design (JSI-based), perfect for instant hydration
const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    return getQueryStorage().getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    getQueryStorage().set(key, value);
  },
  removeItem: (key: string): void => {
    getQueryStorage().remove(key);
  },
};

// Create the persister with MMKV
export const queryPersister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  // Throttle writes to prevent performance issues during rapid updates
  throttleTime: 1000,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: Show cached data immediately, refresh in background
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for offline access

      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Mobile-optimized refetch behaviors
      refetchOnWindowFocus: false, // Mobile doesn't have window focus
      refetchOnMount: true, // Refresh on screen mount
      refetchOnReconnect: true, // Refresh when network returns

      // Network mode for offline support
      networkMode: 'offlineFirst', // Use cache first, then network
    },
    mutations: {
      // Mutations should wait for network
      networkMode: 'online',
    },
  },
});

// Export cache key constants for consistency
export const QUERY_CACHE_KEYS = {
  products: 'products',
  product: (slug: string) => ['product', slug],
  categories: 'categories',
  wallet: 'wallet',
  orders: 'orders',
  pageConfig: (page: string) => ['pageConfig', page],
} as const;
