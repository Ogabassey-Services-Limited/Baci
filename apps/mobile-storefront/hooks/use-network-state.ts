/**
 * Network State Hook
 *
 * 2026 Best Practices for Offline/Network Handling:
 * - Provides real-time network state
 * - Supports retry logic with exponential backoff
 * - Offers graceful degradation patterns
 * - Integrates with React Query for cache management
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('NetworkState');

export interface NetworkState {
  /** Whether device is connected to a network */
  isConnected: boolean;
  /** Whether internet is actually reachable */
  isInternetReachable: boolean | null;
  /** Network connection type (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Combined online status */
  isOnline: boolean;
  /** Whether connection was recently restored */
  wasRecentlyReconnected: boolean;
}

interface UseNetworkStateResult extends NetworkState {
  /** Refresh network state manually */
  refresh: () => Promise<void>;
  /** Execute a callback when network is restored */
  onReconnect: (callback: () => void) => () => void;
}

/**
 * Hook for monitoring network connectivity state
 *
 * @example
 * ```tsx
 * const { isOnline, wasRecentlyReconnected, onReconnect } = useNetworkState();
 *
 * useEffect(() => {
 *   return onReconnect(() => {
 *     refetch(); // Refetch data when network is restored
 *   });
 * }, [onReconnect, refetch]);
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
  // 2026 Critical Fix: Track timeout for cleanup to prevent memory leaks
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const isConnected = netState.isConnected ?? true;
      const isInternetReachable = netState.isInternetReachable ?? true;
      const isOnline = isConnected && isInternetReachable !== false;

      // Detect reconnection
      const wasJustReconnected = wasOffline.current && isOnline;

      setState({
        isConnected,
        isInternetReachable,
        connectionType: netState.type,
        isOnline,
        wasRecentlyReconnected: wasJustReconnected,
      });

      // Execute reconnect callbacks
      // BUG-4-006 FIX: Use Promise.allSettled for callbacks that may be async
      if (wasJustReconnected) {
        const callbackPromises = Array.from(reconnectCallbacks.current).map(
          async (callback) => {
            try {
              await callback();
            } catch (error) {
              log.error('Error in reconnect callback:', error);
            }
          }
        );
        Promise.allSettled(callbackPromises).catch((error) => {
          log.error('Unexpected error in reconnect callbacks:', error);
        });

        // 2026 Critical Fix: Clear previous timeout before setting new one
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Clear the wasRecentlyReconnected flag after a short delay
        reconnectTimeoutRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, wasRecentlyReconnected: false }));
          reconnectTimeoutRef.current = null;
        }, 3000);
      }

      wasOffline.current = !isOnline;
    });

    // Check initial state
    NetInfo.fetch().then((netState) => {
      const isConnected = netState.isConnected ?? true;
      const isInternetReachable = netState.isInternetReachable ?? true;
      const isOnline = isConnected && isInternetReachable !== false;

      setState({
        isConnected,
        isInternetReachable,
        connectionType: netState.type,
        isOnline,
        wasRecentlyReconnected: false,
      });

      wasOffline.current = !isOnline;
    });

    return () => {
      unsubscribe();
      // 2026 Critical Fix: Clear timeout on cleanup to prevent memory leak
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

interface UseRetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Callback when all retries are exhausted */
  onMaxRetriesReached?: () => void;
}

interface UseRetryResult<T> {
  /** Execute the operation with retry logic */
  execute: () => Promise<T | null>;
  /** Current retry count */
  retryCount: number;
  /** Whether currently retrying */
  isRetrying: boolean;
  /** Last error encountered */
  error: Error | null;
  /** Reset retry state */
  reset: () => void;
}

/**
 * Hook for executing operations with exponential backoff retry
 *
 * @example
 * ```tsx
 * const { execute, retryCount, isRetrying, error } = useRetry(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     return response.json();
 *   },
 *   { maxRetries: 3 }
 * );
 * ```
 */
export function useRetry<T>(
  operation: () => Promise<T>,
  options: UseRetryOptions = {}
): UseRetryResult<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onMaxRetriesReached,
  } = options;

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (): Promise<T | null> => {
    setIsRetrying(true);
    setError(null);

    let currentRetry = 0;
    let delay = initialDelay;

    while (currentRetry <= maxRetries) {
      try {
        const result = await operation();
        setRetryCount(0);
        setIsRetrying(false);
        return result;
      } catch (err) {
        currentRetry++;
        setRetryCount(currentRetry);
        setError(err instanceof Error ? err : new Error(String(err)));

        if (currentRetry > maxRetries) {
          setIsRetrying(false);
          onMaxRetriesReached?.();
          return null;
        }

        // Wait with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    setIsRetrying(false);
    return null;
  }, [
    operation,
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    onMaxRetriesReached,
  ]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
    setError(null);
  }, []);

  return {
    execute,
    retryCount,
    isRetrying,
    error,
    reset,
  };
}
