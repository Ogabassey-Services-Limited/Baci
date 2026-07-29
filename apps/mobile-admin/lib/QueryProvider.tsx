/**
 * Query Provider (The Engine)
 * Wraps the app with TanStack Query.
 *
 * Note: onlineManager is synced by useNetworkState (in NetworkProvider)
 * so we don't duplicate the NetInfo subscription here.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useReactQueryAppFocus } from '@/hooks/useReactQueryAppFocus';
import { queryClient } from './query-client';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  useReactQueryAppFocus();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
