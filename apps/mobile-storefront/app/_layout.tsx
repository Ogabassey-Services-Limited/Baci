/**
 * Root Layout for Ogabassey Store
 * Handles navigation, theme, and auth initialization
 * Design aligned with Baci web app
 */

import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import '../global.css';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { RootLayoutNav } from '@/components/navigation/RootLayoutNav';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { offlineQueue } from '@/lib/offline-queue';
import { DEFAULT_SYNC_STORAGE_KEYS, initializeStorage } from '@/lib/storage';
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
  const storeUser = useAuthStore((state) => state.user);
  const storeMerchantId = useAuthStore((state) => state.merchantId);
  const {
    register: registerPushNotifications,
    isRegistered: isPushRegistered,
    registeredUserId,
    isLoading: isPushLoading,
  } = usePushNotifications();
  const initPromiseRef = useRef<Promise<void> | null>(null);
  // Track push registration attempts per userId. Allows up to 3 retries
  // (e.g. permissions granted after first attempt) before giving up.
  const pushAttemptsRef = useRef<{ userId: string | null; count: number }>({
    userId: null,
    count: 0,
  });
  const [showSplash, setShowSplash] = useState(true);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const isPushRegisteredForCurrentUser = Boolean(
    storeUser?.id && isPushRegistered && registeredUserId === storeUser.id
  );

  useEffect(() => {
    if (!isInitialized) {
      initPromiseRef.current = null;
    }
  }, [isInitialized]);

  useEffect(() => {
    const initializeApp = async () => {
      await initializeStorage(DEFAULT_SYNC_STORAGE_KEYS);
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

  // Clear attempt tracking on logout so the same account can re-register
  // after signing out and back in.
  useEffect(() => {
    if (!storeUser?.id) {
      pushAttemptsRef.current = { userId: null, count: 0 };
    }
  }, [storeUser?.id]);

  // Register for push only after auth is fully initialized and user is logged in.
  // merchantId is optional for storefront (single-merchant app).
  // Allows up to 3 attempts per userId to handle cases where permissions are
  // granted after the first attempt. Stops retrying after success or max attempts.
  useEffect(() => {
    const maxAttempts = 3;
    const ref = pushAttemptsRef.current;
    const isNewUser = ref.userId !== storeUser?.id;
    const attemptsLeft = isNewUser || ref.count < maxAttempts;

    if (
      isInitialized &&
      storeUser?.id &&
      !isPushRegisteredForCurrentUser &&
      !isPushLoading &&
      attemptsLeft
    ) {
      if (isNewUser) {
        pushAttemptsRef.current = { userId: storeUser.id, count: 1 };
      } else {
        pushAttemptsRef.current.count += 1;
      }
      void registerPushNotifications(
        storeUser.id,
        storeMerchantId ?? undefined
      );
    }
  }, [
    isInitialized,
    isPushRegisteredForCurrentUser,
    isPushLoading,
    registerPushNotifications,
    storeUser?.id,
    storeMerchantId,
  ]);

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
