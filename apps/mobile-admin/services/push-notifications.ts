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

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification behavior for foreground notifications
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
        console.warn('[Push] Push notifications require a physical device');
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
        console.log('[Push] Expo Push Token:', token);

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
    // Orders channel - HIGH priority for new order alerts
    await Notifications.setNotificationChannelAsync('orders', {
        name: 'New Orders',
        description: 'Notifications when you receive new orders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981', // Green for positive
        sound: 'default',
    });

    // Payments channel - HIGH priority for payment confirmations
    await Notifications.setNotificationChannelAsync('payments', {
        name: 'Payments',
        description: 'Payment received notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        sound: 'default',
    });

    // Stock channel - DEFAULT priority for inventory alerts
    await Notifications.setNotificationChannelAsync('stock', {
        name: 'Stock Alerts',
        description: 'Low stock and inventory notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: '#F59E0B', // Amber for warning
    });

    // Admin channel - DEFAULT priority for platform announcements
    await Notifications.setNotificationChannelAsync('admin', {
        name: 'Platform Updates',
        description: 'Messages from Baci platform',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
    });

    // General channel - LOW priority for misc notifications
    await Notifications.setNotificationChannelAsync('general', {
        name: 'General',
        description: 'Other notifications',
        importance: Notifications.AndroidImportance.LOW,
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
                device_name: Device.modelName || 'Unknown Device',
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

        console.log('[Push] Token saved to server');
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

        console.log('[Push] Token deactivated');
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
    response: Notifications.NotificationResponse
): { screen: string; params?: Record<string, string> } | null {
    const data = response.notification.request.content.data;

    if (!data || !data.type) {
        return null;
    }

    // Route based on notification type
    switch (data.type) {
        case 'new_order':
            return data.order_id
                ? { screen: 'order', params: { id: data.order_id as string } }
                : { screen: 'orders' };

        case 'payment_received':
            return data.order_id
                ? { screen: 'order', params: { id: data.order_id as string } }
                : { screen: 'index' };

        case 'low_stock':
            return data.product_id
                ? { screen: 'product', params: { id: data.product_id as string } }
                : { screen: 'products' };

        case 'admin_broadcast':
            return { screen: 'notifications' };

        default:
            return { screen: 'index' };
    }
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

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}
