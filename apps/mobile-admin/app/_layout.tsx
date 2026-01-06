/**
 * Baci Mobile Admin - Root Layout
 * 2025 Best Practice: Auth-aware routing with Expo Router
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
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet, Text } from 'react-native';
// Remove direct AsyncStorage usage here
import { QueryProvider } from '@/lib/QueryProvider';
import { DARK_COLORS, LIGHT_COLORS } from '@/constants/theme';
import { BagLoader } from '@/components/BagLoader';
import { useAuth } from '@/hooks/useAuth';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';

SplashScreen.preventAutoHideAsync();

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
  const colorScheme = useColorScheme();
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
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: 'orange', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading Fonts...</Text>
      </View>
    );
  }

  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={isDark ? AdminDarkTheme : AdminLightTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <OnboardingProvider>
            <View style={{ flex: 1, backgroundColor: isDark ? DARK_COLORS.background : LIGHT_COLORS.background }}>
              <AuthGate colors={colors} />
            </View>
          </OnboardingProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}

/**
 * Auth Gate - Handles navigation based on auth and onboarding state
 * 2025 Pattern: Declarative auth-based routing with onboarding
 */
function AuthGate({ colors }: { colors: typeof LIGHT_COLORS }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  // Combined loading state
  const isLoading = authLoading || onboardingLoading;

  useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inAuthGroup = segments[0] === 'login';

    // 1. First-time user NOT in onboarding -> Go to Onboarding
    if (!hasSeenOnboarding && !inOnboarding) {
      // Use replace to prevent going back
      router.replace('/onboarding');
      return;
    }

    // 2. Completed onboarding
    if (hasSeenOnboarding) {
      // If unauthenticated and NOT in login -> Go to Login
      if (!isAuthenticated && !inAuthGroup) {
        router.replace('/login');
      }
      // If authenticated and trying to access login/onboarding -> Go to Home
      else if (isAuthenticated && (inAuthGroup || inOnboarding)) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, segments, hasSeenOnboarding]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <BagLoader size={48} />
      </View>
    );
  }

  return (
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
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
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
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
