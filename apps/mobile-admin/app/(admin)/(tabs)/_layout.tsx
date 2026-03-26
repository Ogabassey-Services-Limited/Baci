/**
 * Admin Tab Layout
 * 5-tab navigation: Home, Orders, Products, Customers, Menu
 * Supports light and dark mode
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useFailedOrders } from '@/hooks/useFailedOrders';
import { useTheme } from '@/hooks/useTheme';

export default function TabLayout() {
  if (__DEV__) {
    console.log('[TabLayout] Rendering Debug View');
  }
  const { colors } = useTheme();
  const { data: failedOrders } = useFailedOrders();
  const failedCount = failedOrders?.length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          transform: [{ translateY: 0 }], // Fix for some tab bar glitches
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? [styles.activeIcon, { backgroundColor: colors.goldLight }]
                  : undefined
              }
            >
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarBadge: failedCount > 0 ? failedCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? [styles.activeIcon, { backgroundColor: colors.goldLight }]
                  : undefined
              }
            >
              <Ionicons
                name={focused ? 'receipt' : 'receipt-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? [styles.activeIcon, { backgroundColor: colors.goldLight }]
                  : undefined
              }
            >
              <Ionicons
                name={focused ? 'cube' : 'cube-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? [styles.activeIcon, { backgroundColor: colors.goldLight }]
                  : undefined
              }
            >
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? [styles.activeIcon, { backgroundColor: colors.goldLight }]
                  : undefined
              }
            >
              <Ionicons
                name={focused ? 'menu' : 'menu-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -4,
  },
});
