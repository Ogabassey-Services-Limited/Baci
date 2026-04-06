/**
 * Push Notifications Hook
 * Manages push notification registration and listeners
 */

import type { EventSubscription } from 'expo-modules-core';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
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

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Notifications: typeof import('expo-notifications') | null = null;
let _notificationsReady: Promise<void>;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    Notifications = await import('expo-notifications');
  } catch (e) {
    // BUG-4-005 FIX: Wrap console.debug with __DEV__ check
    if (__DEV__) {
      console.debug(
        '[PushHook] Notifications module ignored or failed to load:',
        e
      );
    }
  }
};

_notificationsReady = loadNativeModules();

interface UsePushNotificationsReturn {
  pushToken: string | null;
  isRegistered: boolean;
  registeredUserId: string | null;
  isLoading: boolean;
  error: string | null;
  register: (userId?: string, merchantId?: string) => Promise<void>;
  unregister: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, merchantId } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      merchantId: state.merchantId,
    }))
  );
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);
  const isRegistered = Boolean(user?.id && registeredUserId === user.id);

  // Navigation helper for notification taps
  const navigate = useEffectEvent(
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
          router.push(
            `/category/${params?.slug}` as import('expo-router').Href
          );
          break;
        default:
          router.push('/');
      }
    }
  );

  // Register for push notifications.
  // Accepts explicit userId/merchantId so the caller's values are used
  // instead of relying on closure state which may be stale due to
  // React Compiler memoization.
  const register = async (
    explicitUserId?: string,
    explicitMerchantId?: string
  ) => {
    if (isLoading) return;

    const resolvedUserId = explicitUserId ?? user?.id;
    const resolvedMerchantId = explicitMerchantId ?? merchantId;

    setIsLoading(true);
    setError(null);

    try {
      const token = await registerForPushNotifications();

      if (token) {
        setPushToken(token);

        // Save to server if user is logged in
        if (resolvedUserId) {
          const saved = await savePushTokenToServer(
            token,
            resolvedUserId,
            resolvedMerchantId || undefined
          );
          setRegisteredUserId(saved ? resolvedUserId : null);

          if (!saved) {
            setError('Failed to register token with server');
          }
        } else {
          // Token obtained but user not logged in - will save on login
          setRegisteredUserId(null);
        }
      } else {
        setRegisteredUserId(null);
        setError('Failed to get push token');
      }
    } catch (err) {
      setRegisteredUserId(null);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Unregister push notifications (on logout)
  const unregister = async () => {
    if (pushToken) {
      await removePushTokenFromServer(pushToken);
      setPushToken(null);
      setRegisteredUserId(null);
    }
  };

  // Set up notification listeners on mount — wait for dynamic import to resolve
  useEffect(() => {
    const cancelledRef = { current: false };

    _notificationsReady.then(() => {
      if (cancelledRef.current || !Notifications) return;

      // BUG-4-001 FIX: Remove old listeners before adding new ones to prevent memory leaks
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }

      // Listener for notifications received while app is foregrounded
      notificationListener.current =
        Notifications.addNotificationReceivedListener(
          (notification: import('expo-notifications').Notification) => {
            log.info('Notification received:', notification);
          }
        );

      // Listener for when user taps on a notification
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener(
          (response: import('expo-notifications').NotificationResponse) => {
            log.info('Notification tapped:', response);
            handleNotificationResponse(response, navigate);
            clearBadge();
          }
        );

      // Check for notification that launched the app
      Notifications.getLastNotificationResponseAsync().then(
        (
          response: import('expo-notifications').NotificationResponse | null
        ) => {
          if (response && !cancelledRef.current) {
            log.info('App launched from notification:', response);
            handleNotificationResponse(response, navigate);
          }
        }
      );
    });

    return () => {
      cancelledRef.current = true;
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Auto-register when user logs in
  useEffect(() => {
    if (user?.id && pushToken && registeredUserId !== user.id) {
      savePushTokenToServer(pushToken, user.id, merchantId || undefined).then(
        (saved) => {
          setRegisteredUserId(saved ? user.id : null);
        }
      );
    }
  }, [merchantId, pushToken, registeredUserId, user?.id]);

  return {
    pushToken,
    isRegistered,
    registeredUserId,
    isLoading,
    error,
    register,
    unregister,
  };
}
