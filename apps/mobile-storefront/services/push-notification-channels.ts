import { Platform } from 'react-native';
import { createLogger } from '@/lib/logger';

const log = createLogger('PushNotificationChannels');

/**
 * Idempotent create-or-update of the Android notification channels. Called by
 * full registration AND directly on app startup, because a stored push token
 * short-circuits full registration — otherwise installs that registered before
 * a new channel was introduced (e.g. `payments`) would never create it and
 * Android 8+ could drop notifications sent to it.
 */
export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  let Notifications: typeof import('expo-notifications') | null = null;
  try {
    Notifications = await import('expo-notifications');
  } catch (e) {
    log.debug('expo-notifications unavailable; skipping channel setup:', e);
    return;
  }
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Order Updates',
    description: 'Notifications about your order status',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#DC2626',
  });

  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments',
    description: 'Wallet credits and payment updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#DC2626',
  });

  await Notifications.setNotificationChannelAsync('promotions', {
    name: 'Deals & Promotions',
    description: 'Special offers and discounts',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  await Notifications.setNotificationChannelAsync('general', {
    name: 'General',
    description: 'General notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
