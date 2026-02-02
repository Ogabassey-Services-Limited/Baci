/**
 * Query Provider with Persistence (The Engine)
 * Wraps the app with TanStack Query + MMKV persistence
 * 2026: Includes NetInfo integration for offline-first mutations
 */

import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { queryClient } from './query-client';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Set up NetInfo listener for TanStack Query's online manager
  useEffect(() => {
    // Configure online manager to use NetInfo for network detection
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline =
        state.isConnected === true && state.isInternetReachable !== false;
      onlineManager.setOnline(isOnline);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      const isOnline =
        state.isConnected === true && state.isInternetReachable !== false;
      onlineManager.setOnline(isOnline);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
