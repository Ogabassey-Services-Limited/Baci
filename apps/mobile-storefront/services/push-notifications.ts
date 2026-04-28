import { getStorefrontNotificationNavigationTarget } from '@baci/shared/lib';
import Constants from 'expo-constants';
import type {
  NotificationResponse,
  PermissionStatus,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const log = createLogger('PushNotifications');

let Device: typeof import('expo-device') | null = null;
let Notifications: typeof import('expo-notifications') | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [dev, notif] = await Promise.all([
      import('expo-device'),
      import('expo-notifications'),
    ]);
    Device = dev;
    Notifications = notif;

    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (e) {
    log.debug('Native modules ignored or failed to load:', e);
  }
};

loadNativeModules();

export interface PushNotificationState {
  token: string | null;
  isRegistered: boolean;
  permissionStatus: PermissionStatus | null;
}

export async function requestPermissions(): Promise<PermissionStatus | null> {
  if (!Notifications) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  }

  return existingStatus;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device || !Notifications) {
    await loadNativeModules();
  }

  if (!Device || !Notifications) return null;

  if (!Device.isDevice) {
    log.warn('Push notifications require a physical device');
    return null;
  }

  const permissionStatus = await requestPermissions();

  if (permissionStatus !== 'granted') {
    log.warn('Push notification permission not granted');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      log.warn('EAS project ID not configured in app.json');
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenResponse.data;
    log.debug('Expo Push Token:', token);

    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    return token;
  } catch (error) {
    log.error('Failed to get push token:', error);
    return null;
  }
}

async function setupAndroidChannels(): Promise<void> {
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Order Updates',
    description: 'Notifications about your order status',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#DC2626',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('promotions', {
    name: 'Deals & Promotions',
    description: 'Special offers and discounts',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('general', {
    name: 'General',
    description: 'General notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function savePushTokenToServer(
  token: string,
  userId: string,
  merchantId: string
): Promise<boolean> {
  const trimmedToken = token.trim();
  const trimmedUserId = userId.trim();
  const trimmedMerchantId = merchantId.trim();

  if (!trimmedToken || !trimmedUserId || !trimmedMerchantId) {
    log.error('Refusing to save push token: empty token/userId/merchantId');
    return false;
  }

  try {
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: trimmedUserId,
        merchant_id: trimmedMerchantId,
        token: trimmedToken,
        platform: Platform.OS,
        device_name: Device?.modelName || 'Unknown',
        app_type: 'storefront',
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict: 'token',
      }
    );

    if (error) {
      log.error('Failed to save push token:', error);
      return false;
    }

    log.debug('Push token saved to server');
    return true;
  } catch (error) {
    log.error('Error saving push token:', error);
    return false;
  }
}

export async function removePushTokenFromServer(
  token: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('token', token);

    if (error) {
      log.error('Failed to remove push token:', error);
      return false;
    }

    return true;
  } catch (error) {
    log.error('Error removing push token:', error);
    return false;
  }
}

export function handleNotificationResponse(
  response: NotificationResponse,
  navigate: (screen: string, params?: Record<string, string>) => void
): void {
  const target = getStorefrontNotificationNavigationTarget(
    response.notification.request.content.data as Record<string, unknown>
  );

  if (!target) return;

  navigate(target.screen, 'params' in target ? target.params : undefined);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  triggerSeconds: number = 1
): Promise<string | null> {
  if (!Notifications) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: triggerSeconds,
    },
  });

  return id;
}

export async function cancelNotification(
  notificationId: string
): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getBadgeCount(): Promise<number> {
  if (!Notifications) return 0;
  return await Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}

export async function clearBadge(): Promise<void> {
  if (!Notifications?.setBadgeCountAsync) return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Silently fail on platforms that don't support badge count (e.g. web)
  }
}
