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
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ConnectivityBanner } from '@/components/ConnectivityBanner';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { ErrorFallback, GlobalErrorBoundary } from '@/components/ErrorBoundary';
import { NegotiationModal } from '@/components/modals/NegotiationModal';
import { CompactStackHeader } from '@/components/navigation/CompactStackHeader';
import { DrawerMenu } from '@/components/navigation/DrawerMenu';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { offlineQueue } from '@/lib/offline-queue';
import { QueryProvider } from '@/lib/QueryProvider';
import { initializeStorage } from '@/lib/storage';
import { initAnalytics } from '@/services/analytics';
import { type CreateOrderRequest, createOrder } from '@/services/orders';
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
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

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

const PERSISTED_STORAGE_KEYS = [
  'cart-storage',
  'saved-storage',
  'comparison-storage',
  'search_history',
] as const;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const cleanup = useAuthStore((state) => state.cleanup);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const { register: registerPushNotifications } = usePushNotifications();
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initPromiseRef.current = null;
    }
  }, [isInitialized]);

  useEffect(() => {
    const initializeApp = async () => {
      await initializeStorage(PERSISTED_STORAGE_KEYS);
      setIsStorageReady(true);

      if (!useAuthStore.getState().isInitialized) {
        await initialize();
      }
      await initAnalytics();
      await offlineQueue.initialize();
      offlineQueue.registerHandler('create_order', async (orderData) => {
        return await createOrder(orderData as CreateOrderRequest);
      });
    };

    if (!initPromiseRef.current) {
      initPromiseRef.current = initializeApp().catch((err) => {
        // Ensure splash screen dismisses even if post-auth init (analytics,
        // offline queue) throws. Auth-store already sets isInitialized on its
        // own errors, but failures after that point were previously unhandled
        // and could leave Android stuck on the splash screen.
        console.error('App initialization error:', err);
        setIsStorageReady(true);
      });
    }

    return () => {
      cleanup();
      offlineQueue.destroy();
    };
  }, [initialize, cleanup]);

  useEffect(() => {
    const timer = setTimeout(() => {
      registerPushNotifications();
    }, 1000);
    return () => clearTimeout(timer);
  }, [registerPushNotifications]);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Safety timeout: force-dismiss splash if auth initialization hangs
  useEffect(() => {
    if (!showSplash) return;
    const timeout = setTimeout(() => {
      setShowSplash(false);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [showSplash]);

  // Hide the native splash as soon as fonts load so the JS AnimatedSplash takes over
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore — splash may already be hidden (e.g. fast reload)
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  if (showSplash) {
    return (
      <AnimatedSplash
        isReady={isInitialized && isStorageReady}
        onAnimationEnd={() => setShowSplash(false)}
      >
        <RootLayoutNav persistenceEnabled={false} />
      </AnimatedSplash>
    );
  }

  return <RootLayoutNav persistenceEnabled />;
}

function RootLayoutNav({
  persistenceEnabled = true,
}: {
  persistenceEnabled?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const enableConnectivityBanner = true;
  const enableChatWidget = true;
  const enableNegotiationModal = true;
  const enableDrawerMenu = true;

  // 2026 Best Practice: Auth guard handles sign out redirects
  // Prevents users from seeing protected screens with stale data after logout
  useAuthGuard();

  return (
    <QueryProvider persistenceEnabled={persistenceEnabled}>
      <GestureHandlerRootView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <SafeAreaProvider>
          <ThemeProvider
            value={
              colorScheme === 'dark' ? OgabasseyDarkTheme : OgabasseyLightTheme
            }
          >
            <SystemBars style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <View
              style={[styles.appShell, { backgroundColor: colors.background }]}
            >
              <GlobalErrorBoundary context="RootNavigation">
                <Stack
                  screenOptions={{
                    header: (props) => <CompactStackHeader {...props} />,
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
                    // 2026 Best Practice: Smooth native transition animations
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                    headerBackTitle: '', // Fix: Hide "index" or other route names from back buttons
                  }}
                >
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                  headerBackTitle: '',
                  title: '', // Ensure folder name isn't used as title/back label
                }}
              />
              <Stack.Screen
                name="product/[slug]"
                options={{
                  headerShown: false,
                  // 2026 Best Practice: Native-standard slide transition for product deep-links
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="checkout"
                options={{
                  title: 'Checkout',
                  presentation: 'card',
                  // 2026 Best Practice: Card-style checkout presentation
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="order-success"
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                  // 2026 Best Practice: Fade for success screens
                  animation: 'fade',
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
                  // 2026 Best Practice: Modal-style auth presentation
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="orders/index"
                options={{
                  title: 'My Orders',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="orders/[id]"
                options={{
                  title: 'Order Details',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="receipts/index"
                options={{
                  title: 'Receipts & Invoices',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="addresses/index"
                options={{
                  title: 'My Addresses',
                  animation: 'slide_from_right',
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
                name="settings/index"
                options={{
                  title: 'App Settings',
                  animation: 'slide_from_right',
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
              {/* 2026 Best Practice: Service screens with consistent animations */}
              <Stack.Screen
                name="utilities"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  contentStyle: {
                    backgroundColor: colors.muted,
                  },
                }}
              />
              <Stack.Screen
                name="swap/index"
                options={{
                  title: 'Swap & Trade-in',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="imei-check/index"
                options={{
                  title: 'IMEI Checker',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="repairs/index"
                options={{
                  title: 'Repair Lab',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="saved/index"
                options={{
                  title: 'Saved Items',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="compare/index"
                options={{
                  title: 'Compare Products',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="bnpl-checkout/index"
                options={{
                  title: 'Buy Now Pay Later',
                  animation: 'slide_from_right',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="crypto-payment/index"
                options={{
                  title: 'Crypto Payment',
                  animation: 'slide_from_right',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="profile/edit"
                options={{
                  title: 'Edit Profile',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="faq/index"
                options={{
                  title: 'Help & Support',
                  animation: 'slide_from_right',
                }}
              />
                </Stack>
              </GlobalErrorBoundary>
              {/* Crash-isolation toggle for startup overlays */}
              {enableConnectivityBanner ? <ConnectivityBanner /> : null}
              {enableChatWidget ? <ChatWidget bottomOffset={140} /> : null}
              {enableNegotiationModal ? <NegotiationModal /> : null}
              {enableDrawerMenu ? <DrawerMenu /> : null}
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  appShell: {
    flex: 1,
  },
});
