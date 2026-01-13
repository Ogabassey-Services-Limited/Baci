/**
 * Push Notifications Service
 * Handles registration, permissions, and token management for Expo Push Notifications
 *
 * Requirements:
 * - Physical device (simulators don't support push)
 * - Development build (not Expo Go)
 * - Firebase project with google-services.json (Android)
 * - APNs configured via EAS (iOS - automatic)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

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

export interface PushNotificationState {
  token: string | null;
  isRegistered: boolean;
  permissionStatus: Notifications.PermissionStatus | null;
}

/**
 * Request push notification permissions
 */
export async function requestPermissions(): Promise<Notifications.PermissionStatus> {
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
  // Push notifications require a physical device
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Check and request permissions
  const permissionStatus = await requestPermissions();

  if (permissionStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  try {
    // Get the Expo Push Token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('EAS project ID not configured in app.json');
      // Still try to get token without project ID for development
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenResponse.data;
    console.log('Expo Push Token:', token);

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Set up Android notification channels
 */
async function setupAndroidChannels(): Promise<void> {
  // Orders channel - high priority for order updates
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Order Updates',
    description: 'Notifications about your order status',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#DC2626',
    sound: 'default',
  });

  // Promotions channel - default priority for deals
  await Notifications.setNotificationChannelAsync('promotions', {
    name: 'Deals & Promotions',
    description: 'Special offers and discounts',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });

  // General channel
  await Notifications.setNotificationChannelAsync('general', {
    name: 'General',
    description: 'General notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Save push token to Supabase for the current user
 * Includes merchant_id for the ogabassey store and is_active flag
 */
export async function savePushTokenToServer(
  token: string,
  userId: string,
  merchantId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        merchant_id: merchantId || null,
        token: token,
        platform: Platform.OS,
        device_name: Device.modelName || 'Unknown',
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict: 'token',
      }
    );

    if (error) {
      console.error('Failed to save push token:', error);
      return false;
    }

    console.log('Push token saved to server');
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
}

/**
 * Remove push token from server (on logout)
 */
export async function removePushTokenFromServer(
  token: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      console.error('Failed to remove push token:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing push token:', error);
    return false;
  }
}

/**
 * Handle notification tap - navigate to relevant screen
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  navigate: (screen: string, params?: Record<string, string>) => void
): void {
  const data = response.notification.request.content.data;

  if (!data) return;

  // Route based on notification type
  switch (data.type) {
    case 'order_update':
      if (data.orderId) {
        navigate('order-details', { id: data.orderId as string });
      } else {
        navigate('orders');
      }
      break;

    case 'promotion':
      if (data.productSlug) {
        navigate('product', { slug: data.productSlug as string });
      } else if (data.categorySlug) {
        navigate('category', { slug: data.categorySlug as string });
      }
      break;

    case 'back_in_stock':
      if (data.productSlug) {
        navigate('product', { slug: data.productSlug as string });
      }
      break;

    default:
      // Default to home
      navigate('home');
  }
}

/**
 * Schedule a local notification (for testing or local reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  triggerSeconds: number = 1
): Promise<string> {
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

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(
  notificationId: string
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the current badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
