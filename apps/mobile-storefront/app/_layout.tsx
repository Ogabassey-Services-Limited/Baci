/**
 * Root Layout for Ogabassey Store
 * Handles navigation, theme, and auth initialization
 * Design aligned with Baci web app
 */

import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import '../global.css';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConnectivityBanner } from '@/components/ConnectivityBanner';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { QueryProvider } from '@/lib/QueryProvider';
import { initAnalytics } from '@/services/analytics';
import { useAuthStore } from '@/stores/auth-store';

// Custom error boundary with network error handling
export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return <ErrorFallback error={error} retry={retry} />;
}

export const unstable_settings = {
  // Ensure that reloading keeps proper navigation
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Custom theme with Ogabassey brand colors
const OgabasseyLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: BRAND.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const OgabasseyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: BRAND.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  const initialize = useAuthStore((state) => state.initialize);
  const { register: registerPushNotifications } = usePushNotifications();

  // Initialize auth and analytics on app start
  useEffect(() => {
    const initializeApp = async () => {
      // Initialize auth
      initialize();

      // Initialize analytics (PostHog)
      await initAnalytics();

      // Initialize ad tracking (Facebook, Google, ATT)
      // await initAdTracking();

      // Track app open event
      // await trackAppOpen();

      // Request ATT permission after a short delay (iOS best practice)
      // Don't show immediately on first launch - wait for user engagement
      // setTimeout(async () => {
      //   await requestTrackingPermission();
      // }, 3000);
    };

    initializeApp();
  }, [initialize]);

  // Register for push notifications after auth initializes
  useEffect(() => {
    // Small delay to ensure app is ready
    const timer = setTimeout(() => {
      registerPushNotifications();
    }, 1000);

    return () => clearTimeout(timer);
  }, [registerPushNotifications]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
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
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider
          value={
            colorScheme === 'dark' ? OgabasseyDarkTheme : OgabasseyLightTheme
          }
        >
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTintColor: colors.text,
              headerTitleStyle: {
                fontWeight: '600',
              },
              headerShadowVisible: false,
              contentStyle: {
                backgroundColor: colors.background,
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="product/[slug]"
              options={{
                headerTransparent: true,
                headerTitle: '',
              }}
            />
            <Stack.Screen
              name="checkout"
              options={{
                title: 'Checkout',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="order-success"
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="search"
              options={{
                headerShown: false,
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="auth/login"
              options={{
                title: '',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="orders/index"
              options={{
                title: 'My Orders',
              }}
            />
            <Stack.Screen
              name="orders/[id]"
              options={{
                title: 'Order Details',
              }}
            />
            <Stack.Screen
              name="addresses/index"
              options={{
                title: 'My Addresses',
              }}
            />
            <Stack.Screen
              name="addresses/[id]"
              options={({ route }) => ({
                title:
                  (route.params as { id?: string })?.id === 'new'
                    ? 'Add Address'
                    : 'Edit Address',
              })}
            />
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="notifications"
              options={{
                title: 'Notifications',
              }}
            />
            <Stack.Screen
              name="category/[slug]"
              options={{
                title: 'Category',
              }}
            />
            <Stack.Screen
              name="wallet/index"
              options={{
                title: 'Wallet & Rewards',
              }}
            />
          </Stack>
          {/* Global Connectivity Banner */}
          <ConnectivityBanner />
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}
