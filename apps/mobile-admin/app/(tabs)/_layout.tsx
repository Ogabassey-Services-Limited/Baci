/**
 * Admin Tab Layout
 * 5-tab navigation: Home, Orders, Products, Customers, Menu
 * Supports light and dark mode
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { TYPOGRAPHY, RADIUS } from '@/constants/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: TYPOGRAPHY.size.xs,
          fontFamily: TYPOGRAPHY.fontFamily.semiBold,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIcon, { backgroundColor: colors.goldLight }] : undefined}>
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
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIcon, { backgroundColor: colors.goldLight }] : undefined}>
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
            <View style={focused ? [styles.activeIcon, { backgroundColor: colors.goldLight }] : undefined}>
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
            <View style={focused ? [styles.activeIcon, { backgroundColor: colors.goldLight }] : undefined}>
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
            <View style={focused ? [styles.activeIcon, { backgroundColor: colors.goldLight }] : undefined}>
              <Ionicons
                name={focused ? 'menu' : 'menu-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      {/* Hide old screens */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: {
    borderRadius: RADIUS.md,
    padding: 6,
    marginBottom: -4,
  },
});
