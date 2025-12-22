/**
 * Baci Mobile Admin - Root Layout
 * Merchant app for order fulfillment and inventory management
 * Uses same Engine (MMKV + TanStack Query) and Brain (Supabase Edge Functions) as storefront
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryProvider } from '@/lib/QueryProvider';

SplashScreen.preventAutoHideAsync();

// Brand colors for admin theme
const BRAND = {
  primary: '#0F172A', // Dark slate for professional admin look
  accent: '#3B82F6', // Blue for actions
};

const AdminLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: BRAND.accent,
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    border: '#E2E8F0',
  },
};

const AdminDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: BRAND.accent,
    background: '#0F172A',
    card: '#1E293B',
    text: '#F8FAFC',
    border: '#334155',
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? AdminDarkTheme : AdminLightTheme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
              },
              headerTintColor: colorScheme === 'dark' ? '#F8FAFC' : '#0F172A',
              headerTitleStyle: {
                fontWeight: '600',
              },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="order/[id]"
              options={{
                title: 'Order Details',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="product/[id]"
              options={{
                title: 'Edit Product',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="scan"
              options={{
                title: 'Scan Barcode',
                presentation: 'modal',
              }}
            />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}
