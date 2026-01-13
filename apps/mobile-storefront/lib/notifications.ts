/**
 * Push Notifications Setup for Expo SDK 54
 * Requires development build (not Expo Go) and physical device
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
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
    console.warn('Push notification permissions not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('EAS projectId not configured in app.json');
      // Still try to get token without projectId for development
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Configure Android notification channel (required for Android 8+)
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
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
      console.error('No user logged in');
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
          device_name: Device.modelName || `${Device.brand} ${Device.modelId}`,
          merchant_id: merchantId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to register push token:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
}

/**
 * Add notification response listener
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
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
