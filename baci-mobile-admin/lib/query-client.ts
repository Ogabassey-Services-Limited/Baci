/**
 * Query Client with MMKV Persistence (The Engine)
 * Flash-Load pattern for instant data hydration
 */

import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createMMKV } from 'react-native-mmkv';

// Dedicated MMKV instance for admin query cache
const queryStorage = createMMKV({
  id: 'baci-admin-query-cache',
});

// MMKV adapter for TanStack Query persister
const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    const value = queryStorage.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string): void => {
    queryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    queryStorage.delete(key);
  },
};

// Create persister with throttling for performance
export const queryPersister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  throttleTime: 1000,
});

// Query client with admin-optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 2 minutes (shorter for admin real-time needs)
      staleTime: 1000 * 60 * 2,
      // Cache data for 12 hours
      gcTime: 1000 * 60 * 60 * 12,
      // Offline-first for resilience
      networkMode: 'offlineFirst',
      // Retry failed requests
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Utility to clear admin cache (useful for logout)
export const clearAdminQueryCache = () => {
  queryStorage.clearAll();
  queryClient.clear();
};
