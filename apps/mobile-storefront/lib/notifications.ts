/**
 * Push Notifications Setup for Expo SDK 54
 * Requires development build (not Expo Go) and physical device
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createLogger } from './logger';
import { supabase } from './supabase';

const log = createLogger('Notifications');

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Device: any = null;
let Notifications: any = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [dev, notif] = await Promise.all([
      import('expo-device'),
      import('expo-notifications')
    ]);
    Device = dev;
    Notifications = notif;

    // Configure notification behavior after successful load
    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch (e) {
    log.debug('Native modules ignored or failed to load:', e);
  }
};

loadNativeModules();

/**
 * Register for push notifications and get the Expo push token
 * Returns null if:
 * - Not running on a physical device
 * - Permissions not granted
 * - Running in Expo Go (requires development build)
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (!Device || !Notifications) {
    log.warn('Push notification modules not loaded');
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    log.warn('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log.warn('Push notification permissions not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      log.warn('EAS projectId not configured in app.json');
      // Still try to get token without projectId for development
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    return tokenData.data;
  } catch (error) {
    log.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Configure Android notification channel (required for Android 8+)
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android' && Notifications) {
    // Orders channel - high priority for new order alerts
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Payments channel
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Stock alerts channel
    await Notifications.setNotificationChannelAsync('stock', {
      name: 'Stock Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F59E0B',
      sound: 'default',
      showBadge: true,
    });

    // General channel
    await Notifications.setNotificationChannelAsync('general', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#3B82F6',
      showBadge: true,
    });
  }
}

/**
 * Register push token with the backend
 */
export async function registerPushTokenWithBackend(
  token: string,
  merchantId: string
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      log.error('No user logged in');
      return false;
    }

    // Call our backend API to register the token
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/api/push-tokens/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS as 'ios' | 'android',
          device_name: (Device && Device.modelName) || `${Device?.brand || 'Unknown'} ${Device?.modelId || ''}`,
          merchant_id: merchantId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      log.error('Failed to register push token:', error);
      return false;
    }

    return true;
  } catch (error) {
    log.error('Error registering push token:', error);
    return false;
  }
}

/**
 * Add notification response listener
 */
export function addNotificationResponseListener(
  callback: (response: any) => void
) {
  if (!Notifications) return { remove: () => { } };
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: any) => void
) {
  if (!Notifications) return { remove: () => { } };
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}

/**
 * Schedule a local notification (for testing or offline alerts)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId = 'general'
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: null, // Immediate
  });
}
