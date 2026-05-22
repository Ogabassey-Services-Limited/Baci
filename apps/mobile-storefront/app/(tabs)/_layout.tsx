/**
 * Tab Layout - Matching Web MobileFooter Design
 * Dark theme with pattern overlay, 5 navigation items
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { TAB_BAR_BASE_HEIGHT } from '@/constants/layout';
import { useCartStore } from '@/stores/cart-store';
import { useSavedStore } from '@/stores/saved-store';
import { useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '@/hooks/useTheme';

export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return <ErrorFallback error={error} retry={retry} />;
}

function TabBarLabel({ focused, label }: { focused: boolean; label: string }) {
  const { colors } = useTheme();
  if (!focused) return null;
  return <Text style={[styles.tabLabel, { color: colors.text }]}>{label}</Text>;
}

function TabBarIcon({
  name,
  focused,
  badge,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.iconContainer}>
      <View
        style={[
          styles.iconInner,
          focused && { backgroundColor: colors.selectedIconBackground },
        ]}
      >
        <Ionicons
          name={name}
          size={22}
          color={focused ? colors.tabIconSelected : colors.tabIconDefault}
          style={{ opacity: focused ? 1 : 0.6 }}
        />
        {badge !== undefined && badge > 0 && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.card,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((state) => state.itemCount());
  const savedCount = useSavedStore((state) => state.items.length);
  const { user, isInitialized } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isInitialized: state.isInitialized,
    }))
  );

  /**
   * 2026 Best Practice: Layout-level auth gating for tabs.
   * Intercept tab presses BEFORE the tab screen mounts.
   * Uses router.push (not replace) so login is stacked ON TOP → back works.
   */
  const createAuthListener = (tabPath: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (isInitialized && !user) {
        e.preventDefault();
        const returnTo = encodeURIComponent(`/(tabs)/${tabPath}`);
        router.push(`/auth/login?returnTo=${returnTo}`);
      }
    },
  });

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom - 4, 8),
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          height: TAB_BAR_BASE_HEIGHT,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 17,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        lazy: true,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true, // Needed for our custom label component
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'home' : 'home-outline'}
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'heart' : 'heart-outline'}
              focused={focused}
              badge={savedCount}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} label="Saved" />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'cart' : 'cart-outline'}
              focused={focused}
              badge={cartCount}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} label="Cart" />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'wallet' : 'wallet-outline'}
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} label="Wallet" />
          ),
        }}
        listeners={createAuthListener('wallet')}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'person' : 'person-outline'}
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} label="Account" />
          ),
        }}
        listeners={createAuthListener('account')}
      />
      {/* Categories hidden from tab bar but reachable via route */}
      <Tabs.Screen
        name="categories"
        options={{
          href: null,
          title: 'Explore',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 4,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
});
