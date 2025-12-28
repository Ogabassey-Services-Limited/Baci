/**
 * Baci Mobile Admin - Root Layout
 * Supports light and dark mode based on system settings
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
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet } from 'react-native';
import { QueryProvider } from '@/lib/QueryProvider';
import { DARK_COLORS, LIGHT_COLORS } from '@/constants/theme';
import { BagLoader } from '@/components/BagLoader';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

// Custom themes matching our design system
const AdminDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: DARK_COLORS.primary,
    background: DARK_COLORS.background,
    card: DARK_COLORS.card,
    text: DARK_COLORS.text,
    border: DARK_COLORS.border,
    notification: DARK_COLORS.notification,
  },
};

const AdminLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: LIGHT_COLORS.primary,
    background: LIGHT_COLORS.background,
    card: LIGHT_COLORS.card,
    text: LIGHT_COLORS.text,
    border: LIGHT_COLORS.border,
    notification: LIGHT_COLORS.notification,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    // Force sign out to ensure we're in a clean state for dev
    // This fixes the issue where a stale session blocks RLS access
    supabase.auth.signOut().then(() => {
      console.log('Signed out to ensure clean state');
    });

    // Hide native splash immediately to show our animated loader
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return <LoadingScreen />;
  }

  return <RootLayoutNav />;
}

function LoadingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.loadingContainer,
        { backgroundColor: isDark ? DARK_COLORS.background : '#f0bf58' },
      ]}
    >
      <BagLoader size={48} />
    </View>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={isDark ? AdminDarkTheme : AdminLightTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTintColor: colors.text,
              headerTitleStyle: {
                fontFamily: 'Inter_600SemiBold',
              },
              headerShadowVisible: false,
              contentStyle: {
                backgroundColor: colors.background,
              },
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
