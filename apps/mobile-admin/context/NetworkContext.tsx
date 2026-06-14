import Ionicons from '@react-native-vector-icons/ionicons';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useTheme } from '@/hooks/useTheme';

interface NetworkProviderProps {
  children: ReactNode;
}

/**
 * Wraps the app to render offline / reconnected banners and invalidate React
 * Query caches when connectivity is restored. No context is exposed — network
 * state is observed internally via useNetworkState().
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

  return (
    <>
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
    </>
  );
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
