import type * as DeviceType from 'expo-device';
import type * as NotificationsType from 'expo-notifications';
import { isRuntimePlatform } from '@/config/runtime-platform';

let Device: typeof DeviceType | null = null;
let Notifications: typeof NotificationsType | null = null;

// 2026 Best Practice: Dynamic imports for native modules to prevent
// evaluation-time crashes on unsupported runtimes.
export const loadPushNotificationNativeModules = async () => {
  if (isRuntimePlatform('web')) return;
  try {
    const dev = await import('expo-device');
    Device = dev;

    if (!Device?.isDevice) {
      if (__DEV__) {
        console.log('[Push] Native notifications skipped on simulator');
      }
      return;
    }

    const notif = await import('expo-notifications');
    Notifications = notif;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.debug('[Push] Native modules ignored or failed to load:', error);
  }
};

export async function getPushNotificationRuntime() {
  if (!Device || !Notifications) {
    await loadPushNotificationNativeModules();
  }

  return { Device, Notifications };
}

export function getLoadedPushDeviceModule() {
  return Device;
}

export async function getPushNotificationsModule() {
  if (!Notifications) {
    await loadPushNotificationNativeModules();
  }

  return Notifications;
}

void loadPushNotificationNativeModules();
