/**
 * usePushNotifications Hook
 * Manages push notification registration and listeners for the admin app
 *
 * Usage:
 * const { token, isRegistered, registerPush, unregisterPush } = usePushNotifications();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  EventSubscription,
  Notification as ExpoNotification,
  NotificationResponse as ExpoNotificationResponse,
} from 'expo-notifications';
import { Platform } from 'react-native';

// Dynamic imports for native modules to prevent evaluation-time crashes
let Notifications: typeof import('expo-notifications') | null = null;
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications');
  }
} catch (_e) {
  console.debug('[PushHook] Native module ignored during evaluation');
}

import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  clearBadge,
  getNotificationNavigationParams,
  registerForPushNotifications,
  removePushTokenFromServer,
  savePushTokenToServer,
} from '@/services/push-notifications';
import { useAuth } from './useAuth';
import { useMerchant } from './useMerchant';

const PUSH_TOKEN_STORAGE_KEY = '@baci_push_token';

function encodeAdminEntityId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const trimmedValue = String(value).trim();
  if (!trimmedValue) {
    return null;
  }

  return encodeURIComponent(trimmedValue);
}

interface UsePushNotificationsResult {
  token: string | null;
  isRegistered: boolean;
  isLoading: boolean;
  registerPush: () => Promise<void>;
  unregisterPush: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [token, setToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { merchant } = useMerchant();
  const { user } = useAuth();
  const router = useRouter();

  // Refs for notification listeners
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);

  /**
   * Register for push notifications
   */
  async function registerPush() {
    if (!user?.id || !merchant?.id) {
      if (__DEV__) {
        console.log('[Push] Cannot register: missing user or merchant');
      }
      return;
    }

    setIsLoading(true);

    try {
      // Get the push token
      const pushToken = await registerForPushNotifications();

      if (!pushToken) {
        if (__DEV__) {
          console.log('[Push] Registration failed - no token received');
        }
        setIsLoading(false);
        return;
      }

      // Save to server
      const saved = await savePushTokenToServer(
        pushToken,
        user.id,
        merchant.id
      );

      if (saved) {
        // Store locally for logout cleanup
        await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
        setToken(pushToken);
        setIsRegistered(true);
        if (__DEV__) {
          console.log('[Push] Registration complete');
        }
      }
    } catch (error) {
      console.error('[Push] Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Unregister push notifications (call on logout)
   */
  async function unregisterPush() {
    try {
      // Get stored token
      const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

      if (storedToken) {
        await removePushTokenFromServer(storedToken);
        await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
      }

      setToken(null);
      setIsRegistered(false);
      if (__DEV__) {
        console.log('[Push] Unregistered');
      }
    } catch (error) {
      console.error('[Push] Unregister error:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  useEffect(() => {
    if (!Notifications) return;
    let cancelled = false;

    // Listener for notifications received while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener(
        (notification: ExpoNotification) => {
          if (__DEV__) {
            console.log(
              '[Push] Notification received:',
              notification.request.content.title
            );
          }
          // You can show an in-app toast here if desired
        }
      );

    // Listener for when user taps on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        (response: ExpoNotificationResponse) => {
          if (__DEV__) {
            console.log('[Push] Notification tapped');
          }

          // Clear badge on interaction
          clearBadge();

          // Navigate to appropriate screen
          const navParams = getNotificationNavigationParams(response);
          if (navParams) {
            const entityId = encodeAdminEntityId(navParams.params?.id);

            if (navParams.screen === 'order') {
              router.push(
                entityId
                  ? (`/(admin)/order/${entityId}` as Href)
                  : '/(admin)/(tabs)/orders'
              );
              return;
            }

            if (navParams.screen === 'product') {
              router.push(
                entityId
                  ? (`/(admin)/product/${entityId}` as Href)
                  : '/(admin)/(tabs)/products'
              );
              return;
            }

            if (navParams.screen === 'orders') {
              router.push('/(admin)/(tabs)/orders');
              return;
            }

            if (navParams.screen === 'products') {
              router.push('/(admin)/(tabs)/products');
              return;
            }

            if (navParams.screen === 'notifications') {
              router.push('/(admin)/notifications');
              return;
            }

            if (navParams.screen === 'negotiations') {
              router.push('/(admin)/negotiations');
              return;
            }

            if (navParams.screen === 'negotiation') {
              router.push(
                entityId
                  ? (`/(admin)/negotiations/${entityId}` as Href)
                  : '/(admin)/negotiations'
              );
              return;
            }

            router.push('/(admin)/(tabs)');
          }
        }
      );

    Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (cancelled || !response) {
        return;
      }

      clearBadge();

      const navParams = getNotificationNavigationParams(response);
      if (!navParams) {
        return;
      }

      const entityId = encodeAdminEntityId(navParams.params?.id);

      if (navParams.screen === 'order') {
        router.push(
          entityId
            ? (`/(admin)/order/${entityId}` as Href)
            : '/(admin)/(tabs)/orders'
        );
        return;
      }

      if (navParams.screen === 'product') {
        router.push(
          entityId
            ? (`/(admin)/product/${entityId}` as Href)
            : '/(admin)/(tabs)/products'
        );
        return;
      }

      if (navParams.screen === 'orders') {
        router.push('/(admin)/(tabs)/orders');
        return;
      }

      if (navParams.screen === 'products') {
        router.push('/(admin)/(tabs)/products');
        return;
      }

      if (navParams.screen === 'notifications') {
        router.push('/(admin)/notifications');
        return;
      }

      if (navParams.screen === 'negotiations') {
        router.push('/(admin)/negotiations');
        return;
      }

      if (navParams.screen === 'negotiation') {
        router.push(
          entityId
            ? (`/(admin)/negotiations/${entityId}` as Href)
            : '/(admin)/negotiations'
        );
        return;
      }

      router.push('/(admin)/(tabs)');
    });

    // Cleanup listeners on unmount
    return () => {
      cancelled = true;
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  /**
   * Check for stored token on mount
   */
  useEffect(() => {
    const checkStoredToken = async () => {
      const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (storedToken) {
        setToken(storedToken);
        setIsRegistered(true);
      }
    };

    checkStoredToken();
  }, []);

  return {
    token,
    isRegistered,
    isLoading,
    registerPush,
    unregisterPush,
  };
}
