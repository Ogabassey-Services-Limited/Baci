/**
 * Push Notifications Hook
 * Manages push notification registration and listeners
 */

import type { EventSubscription } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';
import {
  clearBadge,
  handleNotificationResponse,
  registerForPushNotifications,
  removePushTokenFromServer,
  savePushTokenToServer,
} from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('PushNotifications');

interface UsePushNotificationsReturn {
  pushToken: string | null;
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const merchantId = useAuthStore((state) => state.merchantId);
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);

  // Navigation helper for notification taps
  const navigate = useCallback(
    (screen: string, params?: Record<string, string>) => {
      switch (screen) {
        case 'order-details':
          router.push(`/orders/${params?.id}`);
          break;
        case 'orders':
          router.push('/orders');
          break;
        case 'product':
          router.push(`/product/${params?.slug}`);
          break;
        case 'category':
          router.push(`/category/${params?.slug}` as import('expo-router').Href);
          break;
        default:
          router.push('/');
      }
    },
    []
  );

  // Register for push notifications
  const register = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await registerForPushNotifications();

      if (token) {
        setPushToken(token);

        // Save to server if user is logged in
        if (user?.id) {
          const saved = await savePushTokenToServer(
            token,
            user.id,
            merchantId || undefined
          );
          setIsRegistered(saved);

          if (!saved) {
            setError('Failed to register token with server');
          }
        } else {
          // Token obtained but user not logged in - will save on login
          setIsRegistered(false);
        }
      } else {
        setError('Failed to get push token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, user?.id, merchantId]);

  // Unregister push notifications (on logout)
  const unregister = useCallback(async () => {
    if (pushToken) {
      await removePushTokenFromServer(pushToken);
      setPushToken(null);
      setIsRegistered(false);
    }
  }, [pushToken]);

  // Set up notification listeners on mount
  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        log.info('Notification received:', notification);
        // You can show an in-app toast/banner here if desired
      });

    // Listener for when user taps on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        log.info('Notification tapped:', response);
        handleNotificationResponse(response, navigate);
        // Clear badge when user interacts with notification
        clearBadge();
      });

    // Check for notification that launched the app
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        log.info('App launched from notification:', response);
        handleNotificationResponse(response, navigate);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [navigate]);

  // Auto-register when user logs in
  useEffect(() => {
    if (user?.id && pushToken && !isRegistered) {
      savePushTokenToServer(pushToken, user.id, merchantId || undefined).then(
        (saved) => {
          setIsRegistered(saved);
        }
      );
    }
  }, [user?.id, pushToken, isRegistered, merchantId]);

  return {
    pushToken,
    isRegistered,
    isLoading,
    error,
    register,
    unregister,
  };
}
