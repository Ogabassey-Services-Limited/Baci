/**
 * Push Notifications Service for Baci Admin App
 * Handles registration, permissions, and token management for Expo Push Notifications
 *
 * 2026 Best Practices:
 * - Token refresh on every app launch
 * - Multi-device support (phone + tablet)
 * - Android notification channels
 * - Token cleanup on logout
 * - DeviceNotRegistered handling
 */

import { getAdminNotificationNavigationTarget } from '@baci/shared/lib';
import Constants from 'expo-constants';
import type * as DeviceType from 'expo-device';
import type * as NotificationsType from 'expo-notifications';

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Device: typeof DeviceType | null = null;
let Notifications: typeof NotificationsType | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [dev, notif] = await Promise.all([
      import('expo-device'),
      import('expo-notifications'),
    ]);
    Device = dev;
    Notifications = notif;

    // Configure notification behavior after successful load
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
    console.debug('[Push] Native modules ignored or failed to load:', e);
  }
};

loadNativeModules();

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Note: Notification handler is configured inside loadNativeModules() above

export interface PushNotificationState {
  token: string | null;
  isRegistered: boolean;
  permissionStatus: NotificationsType.PermissionStatus | null;
}

/**
 * Request push notification permissions
 */
export async function requestPermissions(): Promise<NotificationsType.PermissionStatus> {
  if (!Notifications) await loadNativeModules();
  if (!Notifications)
    return 'undetermined' as NotificationsType.PermissionStatus;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  }

  return existingStatus;
}

/**
 * Register for push notifications and get the Expo Push Token
 * Returns null if registration fails or device doesn't support push
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Native modules must be loaded before we can register
  if (!Device || !Notifications) {
    await loadNativeModules();
  }

  if (!Notifications) {
    console.warn('[Push] Notifications module not available');
    return null;
  }

  // Push notifications require a physical device
  if (!Device?.isDevice) {
    console.warn(
      '[Push] Push notifications require a physical device (or Device module not loaded)'
    );
    return null;
  }

  // Check and request permissions
  const permissionStatus = await requestPermissions();

  if (permissionStatus !== 'granted') {
    console.warn('[Push] Push notification permission not granted');
    return null;
  }

  try {
    // Get the Expo Push Token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('[Push] EAS project ID not configured in app.json');
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenResponse.data;
    if (__DEV__) {
      console.log('[Push] Expo Push Token:', token);
    }

    // Configure Android notification channels
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    return token;
  } catch (error) {
    console.error('[Push] Failed to get push token:', error);
    return null;
  }
}

/**
 * Set up Android notification channels
 * Different channels allow users to customize notification behavior per type
 */
async function setupAndroidChannels(): Promise<void> {
  if (!Notifications) return;

  // Orders channel - HIGH priority for new order alerts
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'New Orders',
    description: 'Notifications when you receive new orders',
    importance: Notifications?.AndroidImportance?.HIGH || 4,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981', // Green for positive
  });

  // Payments channel - HIGH priority for payment confirmations
  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments',
    description: 'Payment received notifications',
    importance: Notifications?.AndroidImportance?.HIGH || 4,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
  });

  // Stock channel - DEFAULT priority for inventory alerts
  await Notifications.setNotificationChannelAsync('stock', {
    name: 'Stock Alerts',
    description: 'Low stock and inventory notifications',
    importance: Notifications?.AndroidImportance?.DEFAULT || 3,
    vibrationPattern: [0, 200],
    lightColor: '#F59E0B', // Amber for warning
  });

  // Admin channel - DEFAULT priority for platform announcements
  await Notifications.setNotificationChannelAsync('admin', {
    name: 'Platform Updates',
    description: 'Messages from Baci platform',
    importance: Notifications?.AndroidImportance?.DEFAULT || 3,
  });

  // General channel - LOW priority for misc notifications
  await Notifications.setNotificationChannelAsync('general', {
    name: 'General',
    description: 'Other notifications',
    importance: Notifications?.AndroidImportance?.LOW || 2,
  });
}

/**
 * Save push token to Supabase for the current merchant
 * Uses upsert to handle token refresh (same token = update last_used_at)
 */
export async function savePushTokenToServer(
  token: string,
  userId: string,
  merchantId: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        merchant_id: merchantId,
        token: token,
        platform: Platform.OS,
        device_name: Device?.modelName || 'Unknown Device',
        app_type: 'admin',
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict: 'token',
      }
    );

    if (error) {
      console.error('[Push] Failed to save push token:', error);
      return false;
    }

    if (__DEV__) {
      console.log('[Push] Token saved to server');
    }
    return true;
  } catch (error) {
    console.error('[Push] Error saving push token:', error);
    return false;
  }
}

/**
 * Remove push token from server (call on logout)
 * This prevents notifications being sent to a signed-out device
 */
export async function removePushTokenFromServer(
  token: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('token', token);

    if (error) {
      console.error('[Push] Failed to deactivate push token:', error);
      return false;
    }

    if (__DEV__) {
      console.log('[Push] Token deactivated');
    }
    return true;
  } catch (error) {
    console.error('[Push] Error deactivating push token:', error);
    return false;
  }
}

/**
 * Handle notification tap - returns navigation params
 */
export function getNotificationNavigationParams(
  response: NotificationsType.NotificationResponse
): { screen: string; params?: Record<string, string> } | null {
  const data = response.notification.request.content.data;
  if (!data) {
    return null;
  }

  return getAdminNotificationNavigationTarget(data as Record<string, unknown>);
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  triggerSeconds: number = 1
): Promise<string> {
  if (!Notifications) await loadNativeModules();
  if (!Notifications) throw new Error('Notifications module not available');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
      type:
        Notifications?.SchedulableTriggerInputTypes?.TIME_INTERVAL ||
        'timeInterval',
      seconds: triggerSeconds,
    },
  });

  return id;
}

/**
 * Get the current badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (!Notifications) await loadNativeModules();
  if (!Notifications) return 0;
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (!Notifications) await loadNativeModules();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge
 */
export async function clearBadge(): Promise<void> {
  if (!Notifications) await loadNativeModules();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) await loadNativeModules();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
