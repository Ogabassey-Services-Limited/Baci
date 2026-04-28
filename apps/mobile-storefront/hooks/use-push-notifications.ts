/**
 * Push Notifications Hook
 * Manages push notification registration and listeners
 */

import Constants from 'expo-constants';
import type { EventSubscription } from 'expo-modules-core';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { createLogger } from '@/lib/logger';
import { pickMerchantId } from '@/lib/pick-merchant-id';
import {
  clearStoredPushToken,
  getStoredPushToken,
  isPushOptedOut,
  setPushOptOut,
  storeLocalPushToken,
} from '@/lib/push-token-storage';
import {
  clearBadge,
  handleNotificationResponse,
  registerForPushNotifications,
  removePushTokenFromServer,
  savePushTokenToServer,
} from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('PushNotifications');

/**
 * The storefront app is single-tenant and bound to a known merchant at
 * build time via `app.config.ts -> extra.merchantId`. Use this as the
 * source of truth for push-token merchant attribution so we never race
 * the auth store's relay (which is empty for guests / before merchant
 * context loads). Reads the value once at module load.
 */
const STOREFRONT_MERCHANT_ID = pickMerchantId(
  (Constants.expoConfig?.extra as { merchantId?: string } | undefined)
    ?.merchantId
);

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
  register: (
    userId?: string,
    merchantId?: string,
    opts?: { force?: boolean }
  ) => Promise<void>;
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
        case 'wallet':
          router.push('/wallet');
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
  // opts.force: true clears per-user opt-out (used by settings re-enable toggle).
  const register = async (
    explicitUserId?: string,
    explicitMerchantId?: string,
    opts?: { force?: boolean }
  ) => {
    if (isLoading) return;
    // Idempotent: skip if already server-synced for current user
    if (isRegistered) return;

    const resolvedUserId = explicitUserId ?? user?.id;
    const resolvedMerchantId = pickMerchantId(
      explicitMerchantId,
      merchantId,
      STOREFRONT_MERCHANT_ID
    );

    // Per-user opt-out check. force: true (settings re-enable) clears it first.
    if (resolvedUserId) {
      if (opts?.force) {
        await setPushOptOut(resolvedUserId, false);
      } else if (await isPushOptedOut(resolvedUserId)) return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 3-step token resolution — guarantees stored token is reused even if
      // _layout.tsx fires before the hydration effect completes (race fix):
      //   1. in-memory state (fastest, already hydrated)
      //   2. AsyncStorage (cold start race — read directly here, not just in effect)
      //   3. native Expo call (only if nothing stored)
      let token = pushToken;
      if (!token) token = await getStoredPushToken();
      if (!token) token = await registerForPushNotifications();

      if (token) {
        setPushToken(token);
        await storeLocalPushToken(token); // best-effort local persistence

        if (resolvedUserId && resolvedMerchantId) {
          const saved = await savePushTokenToServer(
            token,
            resolvedUserId,
            resolvedMerchantId
          );
          setRegisteredUserId(saved ? resolvedUserId : null);
          if (!saved) setError('Failed to register token with server');
        } else {
          // Token ready; login-sync effect will upsert when user signs in.
          // Skip silently in the UI to avoid noise for a misconfig the
          // customer can't fix, but emit a tracked error so the
          // unresolvable-merchant case is observable in production.
          if (resolvedUserId && !resolvedMerchantId) {
            try {
              const { trackError } = await import('@/services/analytics');
              trackError(
                'push_token_merchant_id_unresolvable',
                'No merchant id from explicit arg, auth store, or expo config',
                { has_storefront_constant: STOREFRONT_MERCHANT_ID !== null }
              );
            } catch (trackErr) {
              log.warn('Failed to track unresolvable merchantId:', trackErr);
            }
          }
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

  // Unregister push notifications (user-initiated disable from settings).
  // Records user intent FIRST (clear local + opt-out), then awaits server
  // deactivation so a fast re-enable cannot race a background disable request.
  const unregister = async () => {
    const token = pushToken || (await getStoredPushToken());
    await clearStoredPushToken(); // always clear local
    if (user?.id) await setPushOptOut(user.id, true); // always record opt-out
    setPushToken(null);
    setRegisteredUserId(null);
    // Await deactivation so disable → immediate re-enable can't race same token row
    if (token) {
      const removed = await removePushTokenFromServer(token);
      if (!removed) {
        log.warn('Failed to deactivate push token on server during unregister');
      }
    }
  };

  // Hydrate token from AsyncStorage on mount — login-sync effect confirms server state.
  // 2026: cancelled guard mirrors existing listener effect pattern below.
  useEffect(() => {
    let cancelled = false;
    getStoredPushToken().then((stored) => {
      if (stored && !cancelled) setPushToken(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Auto-register when user logs in (login-sync effect)
  useEffect(() => {
    const effectiveMerchantId = pickMerchantId(
      merchantId,
      STOREFRONT_MERCHANT_ID
    );
    if (
      user?.id &&
      pushToken &&
      effectiveMerchantId &&
      registeredUserId !== user.id
    ) {
      savePushTokenToServer(pushToken, user.id, effectiveMerchantId).then(
        (saved) => {
          setRegisteredUserId(saved ? user.id : null);
        }
      );
    }
  }, [merchantId, pushToken, registeredUserId, user?.id]);

  // Reset local React state on sign-out (non-null → null transition).
  // Auth-store owns server cleanup; this effect only resets hook state.
  const prevUserRef = useRef(user);
  useEffect(() => {
    const wasSignedIn = prevUserRef.current !== null;
    prevUserRef.current = user;
    if (wasSignedIn && user === null) {
      setPushToken(null);
      setRegisteredUserId(null);
    }
  }, [user]);

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
