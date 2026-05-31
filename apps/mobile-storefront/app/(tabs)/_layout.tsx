import { Tabs, router } from 'expo-router';
import type React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { getTabBarShadowStyle } from '@/components/navigation/TabBar.shadows';
import { TAB_BAR_BASE_HEIGHT } from '@/constants/layout';
import { useCartStore } from '@/stores/cart-store';
import { useSavedStore } from '@/stores/saved-store';
import { useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '@/hooks/useTheme';
import { GadgetPattern } from '@/components/storefront/GadgetPattern';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import { BRAND } from '@/constants/Colors';
import { TabBarLabel, TabBarIcon } from '@/components/navigation/TabBarComponents';

export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return <ErrorFallback error={error} retry={retry} />;
}


export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottomInset = insets.bottom > 0 ? insets.bottom : 8;
  // Extra spacing to account for visual spacing/shadows and touch target comfort
  const EXTRA_TAB_BAR_HEIGHT = 6;

  const cartCount = useCartStore((state) => state.itemCount());
  const savedCount = useSavedStore((state) => state.items.length);
  const { user, isInitialized } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isInitialized: state.isInitialized,
    }))
  );

  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const isElite = template.headerStyle === 'elite';

  const activeTint = colors.text;
  const inactiveTint = colors.mutedForeground;

  const eliteBg = isDark ? '#000000' : '#ffffff';
  const elitePatternColor = isDark ? '#ffffff' : BRAND.primary;
  const elitePatternOpacity = isDark ? 0.06 : 0.12;
  const eliteBorderColor = isDark ? '#1f2937' : colors.border;

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
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isElite ? 'transparent' : colors.card,
          borderTopWidth: 1,
          borderTopColor: isElite ? eliteBorderColor : colors.border,
          height: TAB_BAR_BASE_HEIGHT + safeBottomInset + EXTRA_TAB_BAR_HEIGHT,
          paddingBottom: safeBottomInset,
          paddingTop: 6,
          ...getTabBarShadowStyle(Platform.OS === 'web' ? 'web' : 'native'),
        },
        tabBarBackground: isElite
          ? () => (
              <View
                style={{
                  ...StyleSheet.absoluteFill,
                  backgroundColor: eliteBg,
                  overflow: 'hidden',
                }}
              >
                <GadgetPattern
                  opacity={elitePatternOpacity}
                  height={
                    TAB_BAR_BASE_HEIGHT + safeBottomInset + EXTRA_TAB_BAR_HEIGHT
                  }
                  variant="tabbar"
                  color={elitePatternColor}
                />
              </View>
            )
          : undefined,
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

