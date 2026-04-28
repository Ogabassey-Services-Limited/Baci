import type { EventSubscription } from 'expo-modules-core';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { pickMerchantId } from '@/lib/pick-merchant-id';
import { trackError } from '@/services/analytics';
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

const STOREFRONT_MERCHANT_ID = pickMerchantId(CONFIG.MERCHANT_ID);

let Notifications: typeof import('expo-notifications') | null = null;
let _notificationsReady: Promise<void>;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    Notifications = await import('expo-notifications');
  } catch (e) {
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

  const register = async (
    explicitUserId?: string,
    explicitMerchantId?: string,
    opts?: { force?: boolean }
  ) => {
    if (isLoading) return;
    if (isRegistered) return;

    const resolvedUserId = explicitUserId ?? user?.id;
    const resolvedMerchantId = pickMerchantId(
      explicitMerchantId,
      merchantId,
      STOREFRONT_MERCHANT_ID
    );

    if (resolvedUserId) {
      if (opts?.force) {
        await setPushOptOut(resolvedUserId, false);
      } else if (await isPushOptedOut(resolvedUserId)) return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let token = pushToken;
      if (!token) token = await getStoredPushToken();
      if (!token) token = await registerForPushNotifications();

      if (token) {
        setPushToken(token);
        await storeLocalPushToken(token);

        if (resolvedUserId && resolvedMerchantId) {
          const saved = await savePushTokenToServer(
            token,
            resolvedUserId,
            resolvedMerchantId
          );
          setRegisteredUserId(saved ? resolvedUserId : null);
          if (!saved) setError('Failed to register token with server');
        } else {
          if (resolvedUserId && !resolvedMerchantId) {
            try {
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

  const unregister = async () => {
    const token = pushToken || (await getStoredPushToken());
    await clearStoredPushToken();
    if (user?.id) await setPushOptOut(user.id, true);
    setPushToken(null);
    setRegisteredUserId(null);
    if (token) {
      const removed = await removePushTokenFromServer(token);
      if (!removed) {
        log.warn('Failed to deactivate push token on server during unregister');
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    getStoredPushToken().then((stored) => {
      if (stored && !cancelled) setPushToken(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };

    _notificationsReady.then(() => {
      if (cancelledRef.current || !Notifications) return;

      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }

      notificationListener.current =
        Notifications.addNotificationReceivedListener(
          (notification: import('expo-notifications').Notification) => {
            log.info('Notification received:', notification);
          }
        );

      responseListener.current =
        Notifications.addNotificationResponseReceivedListener(
          (response: import('expo-notifications').NotificationResponse) => {
            log.info('Notification tapped:', response);
            handleNotificationResponse(response, navigate);
            clearBadge();
          }
        );

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
