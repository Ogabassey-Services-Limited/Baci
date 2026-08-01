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

import { getAdminNotificationNavigationTarget } from '@baci/shared';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import {
  getRuntimePlatform,
  isRuntimePlatform,
} from '@/config/runtime-platform';
import { supabase } from '@/lib/supabase';
import { setupAndroidChannels } from './push-notification-channels';
import {
  getLoadedPushDeviceModule,
  getPushNotificationRuntime,
  getPushNotificationsModule,
} from './push-notification-native-modules';

/**
 * Parse the installed native build number (Android `versionCode`, iOS
 * `CFBundleVersion`) into a non-negative integer for update-nudge targeting,
 * or `null` when unavailable/malformed.
 *
 * Uses strict `Number(...)` (not `parseInt`) to mirror the server-side gate's
 * parser, so a partially numeric build like `646-beta` or a dotted `646.1` is
 * rejected as malformed rather than truncated to `646`.
 */
export function resolveNativeBuildNumber(
  value: string | null = Application.nativeBuildVersion
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export interface PushNotificationState {
  token: string | null;
  isRegistered: boolean;
  permissionStatus: NotificationsType.PermissionStatus | null;
}

/**
 * Request push notification permissions
 */
export async function requestPermissions(): Promise<NotificationsType.PermissionStatus> {
  const Notifications = await getPushNotificationsModule();
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
  const { Device, Notifications } = await getPushNotificationRuntime();

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

  if (__DEV__ && process.env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH_IN_DEV !== '1') {
    console.log(
      '[Push] Remote token registration skipped for local development build'
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
    if (isRuntimePlatform('android')) {
      await setupAndroidChannels(Notifications);
    }

    return token;
  } catch (error) {
    console.error('[Push] Failed to get push token:', error);
    return null;
  }
}

/**
 * Save push token to Supabase for the current merchant.
 *
 * Registers via the SECURITY DEFINER RPC `register_push_token` instead of a raw
 * upsert. Expo push tokens are device-unique, so when a different account signs
 * in on the same device the upsert's UPDATE branch (on conflict: token) hits a
 * row still owned by the previous user_id and is blocked by RLS (42501). The RPC
 * derives ownership from the authenticated Supabase session, re-claims the token
 * atomically, and records the native build number used by the release-policy
 * update gate.
 */
export async function savePushTokenToServer(
  token: string,
  merchantId: string
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_merchant_id: merchantId,
      p_platform: getRuntimePlatform(),
      p_device_name: getLoadedPushDeviceModule()?.modelName || 'Unknown Device',
      p_app_type: 'admin',
      p_build_number: resolveNativeBuildNumber(),
      p_shipment_update_capability: 1,
    });

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
  const Notifications = await getPushNotificationsModule();
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
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return 0;
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge
 */
export async function clearBadge(): Promise<void> {
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
