import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type NetworkState, useNetworkState } from '@/hooks/useNetworkState';
import { useTheme } from '@/hooks/useTheme';

interface NetworkContextValue extends NetworkState {
  refresh: () => Promise<void>;
  onReconnect: (callback: () => void) => () => void;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(
  undefined
);

interface NetworkProviderProps {
  children: ReactNode;
}

/**
 * Network Provider component that wraps the app
 * Provides network state context and displays offline banner
 */
export function NetworkProvider({ children }: NetworkProviderProps) {
  const networkState = useNetworkState();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // Auto-invalidate queries when connection is restored
  useEffect(() => {
    return networkState.onReconnect(() => {
      if (__DEV__) {
        console.log(
          '[NetworkProvider] Connection restored - invalidating queries'
        );
      }
      // Invalidate all queries to refetch fresh data
      queryClient.invalidateQueries();
    });
  }, [networkState, queryClient]);

  // React Compiler (babel-plugin-react-compiler) auto-memoizes the context value,
  // so no manual useMemo wrapper is needed. See babel.config.js for compiler config.
  return (
    <NetworkContext.Provider value={networkState}>
      {children}
      {/* Offline Banner - shown when device is offline */}
      {!networkState.isOnline && (
        <View
          style={[
            styles.banner,
            {
              top: insets.top,
              backgroundColor: colors.warning,
            },
          ]}
        >
          <Ionicons
            name="cloud-offline"
            size={16}
            color={isDark ? colors.background : colors.text}
            style={styles.icon}
          />
          <Text
            style={[
              styles.bannerText,
              { color: isDark ? colors.background : colors.text },
            ]}
          >
            No internet connection. Some features may be unavailable.
          </Text>
        </View>
      )}
      {/* Reconnected Banner - briefly shown when connection is restored */}
      {networkState.wasRecentlyReconnected && networkState.isOnline && (
        <View
          style={[
            styles.banner,
            {
              top: insets.top,
              backgroundColor: colors.success,
            },
          ]}
        >
          <Ionicons
            name="cloud-done"
            size={16}
            color={colors.textOnPrimary}
            style={styles.icon}
          />
          <Text style={[styles.bannerText, { color: colors.textOnPrimary }]}>
            Back online! Syncing data...
          </Text>
        </View>
      )}
    </NetworkContext.Provider>
  );
}

/**
 * Hook to access network state from any component
 *
 * @example
 * ```tsx
 * const { isOnline, wasRecentlyReconnected } = useNetwork();
 *
 * if (!isOnline) {
 *   return <Text>Please check your internet connection</Text>;
 * }
 * ```
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

/**
 * Z-Index Hierarchy (higher = on top):
 * - Network Banners: 10000 (critical system UI)
 * - Toast: 9000
 * - Modal overlays: 1000-2000
 * - Dropdowns: 100-500
 * - Decorative effects: 50
 */
const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 10000, // Network banners should be highest - critical system UI
  },
  icon: {
    marginRight: 8,
  },
  bannerText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
