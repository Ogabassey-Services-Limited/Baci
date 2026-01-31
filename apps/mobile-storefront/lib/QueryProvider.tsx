/**
 * React Query Provider with MMKV Persistence
 *
 * 2025 Best Practice: "Flash-Load" Pattern
 * - PersistQueryClientProvider hydrates cache from MMKV on startup
 * - Products and wallet data appear instantly (< 50ms)
 * - Network requests happen in background after cached data is shown
 */

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type React from 'react';
import { createLogger } from './logger';
import { queryClient, queryPersister } from './query-client';

const log = createLogger('QueryProvider');

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        // Max age for persisted data (24 hours)
        maxAge: 1000 * 60 * 60 * 24,
        // Only persist successful queries
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Don't persist failed or pending queries
            return query.state.status === 'success';
          },
        },
      }}
      // Show children immediately while hydrating (for instant UI)
      onSuccess={() => {
        // Cache hydration complete - queries will now use cached data
        log.debug('Cache hydrated from MMKV');
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
