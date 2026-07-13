/**
 * Network State Hook for Mobile Admin
 *
 * Provides real-time network state monitoring via NetInfo with a debounce
 * on the offline transition to avoid false positives from brief NetInfo
 * blips (common on iOS Simulator and during wifi/cellular handoffs).
 *
 * - Offline transitions are debounced (2 s) to prevent flash banners
 * - Online transitions are immediate so the UI recovers quickly
 * - Integrates with TanStack Query's onlineManager
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

export interface NetworkState {
  /** Whether device is connected to a network */
  isConnected: boolean;
  /** Whether internet is actually reachable */
  isInternetReachable: boolean | null;
  /** Network connection type (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Combined online status — debounced before going offline */
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

/** How long (ms) to wait before confirming "offline" to the UI */
const OFFLINE_DEBOUNCE_MS = 2000;
/** How long (ms) to show the "back online" banner */
const RECONNECT_BANNER_MS = 3000;

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
  const offlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleNetState = (netState: NetInfoState) => {
      const isConnected = netState.isConnected ?? true;
      const isInternetReachable = netState.isInternetReachable ?? true;
      const rawOnline = isConnected && isInternetReachable !== false;

      // Always sync TanStack Query immediately (mutations should pause fast)
      onlineManager.setOnline(rawOnline);

      if (rawOnline) {
        // Going ONLINE — apply immediately and cancel any pending offline timer
        if (offlineDebounceRef.current) {
          clearTimeout(offlineDebounceRef.current);
          offlineDebounceRef.current = null;
        }

        const wasJustReconnected = wasOffline.current;

        setState({
          isConnected,
          isInternetReachable,
          connectionType: netState.type,
          isOnline: true,
          wasRecentlyReconnected: wasJustReconnected,
        });

        if (wasJustReconnected) {
          if (__DEV__) {
            console.log(
              '[Network] Connection restored — executing reconnect callbacks'
            );
          }
          for (const cb of reconnectCallbacks.current) {
            try {
              cb();
            } catch (error) {
              console.error('[Network] Error in reconnect callback:', error);
            }
          }

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            setState((prev) => ({ ...prev, wasRecentlyReconnected: false }));
            reconnectTimeoutRef.current = null;
          }, RECONNECT_BANNER_MS);
        }

        wasOffline.current = false;
      } else if (!offlineDebounceRef.current) {
        // Going OFFLINE — debounce before showing the banner.
        // This filters out brief NetInfo blips on iOS Simulator and
        // during wifi↔cellular handoffs.
        offlineDebounceRef.current = setTimeout(() => {
          offlineDebounceRef.current = null;
          wasOffline.current = true;
          setState({
            isConnected,
            isInternetReachable,
            connectionType: netState.type,
            isOnline: false,
            wasRecentlyReconnected: false,
          });
          if (__DEV__) {
            console.log('[Network] Device confirmed offline');
          }
        }, OFFLINE_DEBOUNCE_MS);
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetState);

    // Fetch initial state — only set to online immediately; offline is debounced
    // through the listener so we don't flash the banner on startup
    NetInfo.fetch().then((netState) => {
      const isConnected = netState.isConnected ?? true;
      const isInternetReachable = netState.isInternetReachable ?? true;
      const rawOnline = isConnected && isInternetReachable !== false;

      onlineManager.setOnline(rawOnline);

      if (rawOnline) {
        setState({
          isConnected,
          isInternetReachable,
          connectionType: netState.type,
          isOnline: true,
          wasRecentlyReconnected: false,
        });
      }
      wasOffline.current = !rawOnline;
    });

    return () => {
      unsubscribe();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
    };
  }, []);

  async function refresh() {
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
  }

  function onReconnect(callback: () => void) {
    reconnectCallbacks.current.add(callback);
    return () => {
      reconnectCallbacks.current.delete(callback);
    };
  }

  return {
    ...state,
    refresh,
    onReconnect,
  };
}
