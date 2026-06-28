import type * as DeviceType from 'expo-device';
import type * as NotificationsType from 'expo-notifications';
import { isRuntimePlatform } from '@/config/runtime-platform';

let Device: typeof DeviceType | null = null;
let Notifications: typeof NotificationsType | null = null;
let nativeModulesLoadHandled = false;
let nativeModulesLoadPromise: Promise<void> | null = null;
let notificationHandlerRegistered = false;

// 2026 Best Practice: Dynamic imports for native modules to prevent
// evaluation-time crashes on unsupported runtimes.
export const loadPushNotificationNativeModules = () => {
  if (nativeModulesLoadHandled && nativeModulesLoadPromise) {
    return nativeModulesLoadPromise;
  }

  nativeModulesLoadPromise ??= (async () => {
    try {
      if (isRuntimePlatform('web')) return;

      const dev = await import('expo-device');
      Device = dev;

      const notif = await import('expo-notifications');
      Notifications = notif;

      if (!notificationHandlerRegistered) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        notificationHandlerRegistered = true;
      }
    } catch (error) {
      console.debug('[Push] Native modules ignored or failed to load:', error);
    } finally {
      nativeModulesLoadHandled = true;
    }
  })();

  return nativeModulesLoadPromise;
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
