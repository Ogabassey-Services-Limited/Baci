/**
 * React Query Client Configuration with AsyncStorage Persistence
 *
 * 2025 Best Practice: "Flash-Load" Pattern
 * - Data displayed from cache within 50ms on app start
 * - Background refresh happens after cached data is shown
 * - 24-hour cache retention for offline resilience
 *
 * Note: Using AsyncStorage for Expo Go compatibility.
 * For production builds, consider switching to MMKV for better performance.
 */

import { createMMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

// Initialize MMKV storage instance
const storage = createMMKV();

/**
 * MMKV-based Persister (High Performance)
 * MMKV is ~10x faster than AsyncStorage and works synchronously,
 * enabling the "Flash-Load" pattern.
 */
export const queryPersister = createSyncStoragePersister({
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.remove(key),
  },
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
