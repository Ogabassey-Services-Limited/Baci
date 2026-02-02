/**
 * Network State Hook for Mobile Admin
 *
 * 2026 Best Practices for Offline/Network Handling:
 * - Provides real-time network state monitoring via NetInfo
 * - Supports reconnection detection for data refresh
 * - Integrates with TanStack Query's onlineManager
 * - Enables offline-first patterns for admin operations
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface NetworkState {
  /** Whether device is connected to a network */
  isConnected: boolean;
  /** Whether internet is actually reachable */
  isInternetReachable: boolean | null;
  /** Network connection type (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Combined online status - true if connected AND internet reachable */
  isOnline: boolean;
  /** Whether connection was recently restored (for UI indicators) */
  wasRecentlyReconnected: boolean;
}

interface UseNetworkStateResult extends NetworkState {
  /** Refresh network state manually */
  refresh: () => Promise<void>;
  /** Register a callback to run when network is restored */
  onReconnect: (callback: () => void) => () => void;
}

/**
 * Hook for monitoring network connectivity state
 *
 * @example
 * ```tsx
 * const { isOnline, wasRecentlyReconnected, onReconnect } = useNetworkState();
 *
 * // Show offline banner when not online
 * if (!isOnline) {
 *   return <OfflineBanner />;
 * }
 *
 * // Refetch data when connection is restored
 * useEffect(() => {
 *   return onReconnect(() => {
 *     queryClient.invalidateQueries();
 *   });
 * }, [onReconnect]);
 * ```
 */
export function useNetworkState(): UseNetworkStateResult {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    connectionType: null,
    isOnline: true,
    wasRecentlyReconnected: false,
  });

  const wasOffline = useRef(false);
  const reconnectCallbacks = useRef<Set<() => void>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const isConnected = netState.isConnected ?? true;
      const isInternetReachable = netState.isInternetReachable ?? true;
      const isOnline = isConnected && isInternetReachable !== false;

      // Sync with TanStack Query's online manager
      onlineManager.setOnline(isOnline);

      // Detect reconnection (was offline, now online)
      const wasJustReconnected = wasOffline.current && isOnline;

      setState({
        isConnected,
        isInternetReachable,
        connectionType: netState.type,
        isOnline,
        wasRecentlyReconnected: wasJustReconnected,
      });

      // Execute reconnect callbacks when connection is restored
      if (wasJustReconnected) {
        if (__DEV__) {
          console.log('[Network] Connection restored - executing reconnect callbacks');
        }
        reconnectCallbacks.current.forEach((callback) => {
          try {
            callback();
          } catch (error) {
            console.error('[Network] Error in reconnect callback:', error);
          }
        });

        // Clear previous timeout before setting new one (prevent memory leak)
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Clear the wasRecentlyReconnected flag after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, wasRecentlyReconnected: false }));
          reconnectTimeoutRef.current = null;
        }, 3000);
      }

      wasOffline.current = !isOnline;

      // Log network state changes for debugging
      if (!isOnline && __DEV__) {
        console.log('[Network] Device went offline');
      }
    });

    // Fetch initial network state
    NetInfo.fetch().then((netState) => {
      const isConnected = netState.isConnected ?? true;
      const isInternetReachable = netState.isInternetReachable ?? true;
      const isOnline = isConnected && isInternetReachable !== false;

      // Sync initial state with TanStack Query
      onlineManager.setOnline(isOnline);

      setState({
        isConnected,
        isInternetReachable,
        connectionType: netState.type,
        isOnline,
        wasRecentlyReconnected: false,
      });

      wasOffline.current = !isOnline;
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  const refresh = useCallback(async () => {
    const netState = await NetInfo.fetch();
    const isConnected = netState.isConnected ?? true;
    const isInternetReachable = netState.isInternetReachable ?? true;
    const isOnline = isConnected && isInternetReachable !== false;

    onlineManager.setOnline(isOnline);

    setState((prev) => ({
      ...prev,
      isConnected,
      isInternetReachable,
      connectionType: netState.type,
      isOnline,
    }));
  }, []);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacks.current.add(callback);
    return () => {
      reconnectCallbacks.current.delete(callback);
    };
  }, []);

  return {
    ...state,
    refresh,
    onReconnect,
  };
}

/**
 * Configure TanStack Query's online manager to use NetInfo
 * Call this once at app initialization (in QueryProvider)
 */
export function setupNetworkListener(): () => void {
  // Set up NetInfo listener for TanStack Query
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline =
      state.isConnected === true && state.isInternetReachable !== false;
    onlineManager.setOnline(isOnline);
  });

  return unsubscribe;
}
