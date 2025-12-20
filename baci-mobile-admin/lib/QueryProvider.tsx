/**
 * Query Provider with Persistence (The Engine)
 * Wraps the app with TanStack Query + MMKV persistence
 */

import React, { ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister } from './query-client';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 12, // 12 hours for admin data
        buster: 'v1', // Increment to invalidate cache on schema changes
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
