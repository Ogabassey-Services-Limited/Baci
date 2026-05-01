/**
 * Query Client with MMKV Persistence (The Engine)
 * Flash-Load pattern for instant data hydration
 * 2026: Includes offline mutation queue persistence
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { type MutationMeta, QueryClient } from '@tanstack/react-query';
import { createMMKV } from 'react-native-mmkv';

// Dedicated MMKV instance for admin query cache
const queryStorage = createMMKV({
  id: 'baci-admin-query-cache',
});

// Dedicated MMKV instance for offline mutation queue
const mutationStorage = createMMKV({
  id: 'baci-admin-mutation-queue',
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
    queryStorage.remove(key);
  },
};

// MMKV adapter for mutation queue persistence
export const mutationStorageAdapter = {
  getItem: (key: string): string | null => {
    const value = mutationStorage.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string): void => {
    mutationStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    mutationStorage.remove(key);
  },
};

// Create persister with throttling for performance
export const queryPersister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  throttleTime: 1000,
});

// Create mutation persister for offline queue
export const mutationPersister = createSyncStoragePersister({
  storage: mutationStorageAdapter,
  throttleTime: 500, // Faster persistence for mutations
});

/**
 * Meta type for mutations that support offline queueing
 */
export interface OfflineMutationMeta extends MutationMeta {
  /** Unique key for identifying this mutation type */
  mutationKey?: string[];
  /** Whether this mutation should be persisted for offline retry */
  persist?: boolean;
  /** Timestamp when mutation was created (for ordering) */
  createdAt?: number;
}

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
      // Retry mutations once on failure
      retry: 1,
      // Offline-first: pause mutations when offline, resume when online
      networkMode: 'offlineFirst',
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Utility to clear admin cache (useful for logout)
export const clearAdminQueryCache = () => {
  queryStorage.clearAll();
  mutationStorage.clearAll();
  queryClient.clear();
};

// Get pending mutations count (for UI indicator)
export const getPendingMutationsCount = (): number => {
  const mutationCache = queryClient.getMutationCache();
  return mutationCache.getAll().filter((m) => m.state.isPaused).length;
};
