import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  canRequestTrackingTransparency,
  getTrackingPermissionStatus,
  requestTrackingPermissionStatus,
} from '@/lib/tracking-transparency';

type PermissionType = 'notifications' | 'tracking';

interface PermissionState {
  // Track last request time for cool-down logic
  lastRequestTime: Record<PermissionType, number | null>;
  // Track how many times user deny the soft ask
  denialCounts: Record<PermissionType, number>;
  // Value to check if we should show the modal
  shouldShowModal: (type: PermissionType) => boolean;
  // Actions
  markRequested: (type: PermissionType) => void;
  markDenied: (type: PermissionType) => void;
  reset: () => void;
}

export const PERMISSION_SOFT_ASK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
let notificationsModulePromise: Promise<
  typeof import('expo-notifications')
> | null = null;

function loadNotifications() {
  notificationsModulePromise ??= import('expo-notifications').catch(
    (error: unknown) => {
      notificationsModulePromise = null;
      throw error;
    }
  );
  return notificationsModulePromise;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      lastRequestTime: {
        notifications: null,
        tracking: null,
      },
      denialCounts: {
        notifications: 0,
        tracking: 0,
      },
      shouldShowModal: (type) => {
        const { lastRequestTime, denialCounts } = get();
        const lastTime = lastRequestTime[type];
        const count = denialCounts[type];

        // If never requested, show it
        if (!lastTime) return true;

        // If denied less than 3 times, check cool-down
        if (count < 3) {
          const now = Date.now();
          return now - lastTime > PERMISSION_SOFT_ASK_COOLDOWN_MS;
        }

        // If denied 3+ times, don't show again (or wait much longer/manual trigger only)
        return false;
      },
      markRequested: (type) => {
        set((state) => ({
          lastRequestTime: {
            ...state.lastRequestTime,
            [type]: Date.now(),
          },
        }));
      },
      markDenied: (type) => {
        set((state) => ({
          denialCounts: {
            ...state.denialCounts,
            [type]: state.denialCounts[type] + 1,
          },
          lastRequestTime: {
            ...state.lastRequestTime,
            [type]: Date.now(), // Reset cool-down start
          },
        }));
      },
      reset: () => {
        set({
          lastRequestTime: { notifications: null, tracking: null },
          denialCounts: { notifications: 0, tracking: 0 },
        });
      },
    }),
    {
      name: 'permission-booster-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Hook to manage permissions with Soft Ask logic
 */
export const usePermissionBooster = () => {
  // Selecting all 6/6 store properties with useShallow provides no
  // performance benefit — revert to the bare hook.
  const store = usePermissionStore();

  const requestPermission = async (
    type: PermissionType
  ): Promise<'granted' | 'denied' | 'soft-ask-needed'> => {
    // 1. Check current system status
    let status;
    if (type === 'notifications') {
      const notifications = await loadNotifications();
      const settings = await notifications.getPermissionsAsync();
      status = settings.status;
    } else {
      if (!canRequestTrackingTransparency()) {
        return 'granted';
      }
      try {
        const trackingPermission = await getTrackingPermissionStatus();
        status = trackingPermission.status;
      } catch {
        return 'denied';
      }
    }

    // If already granted, nothing to do
    if (status === 'granted') return 'granted';

    // If not granted, check if we should show soft ask
    if (store.shouldShowModal(type)) {
      return 'soft-ask-needed';
    }

    return 'denied';
  };

  const triggerSystemPrompt = async (
    type: PermissionType
  ): Promise<boolean> => {
    store.markRequested(type);

    if (type === 'notifications') {
      const notifications = await loadNotifications();
      const { status } = await notifications.requestPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await requestTrackingPermissionStatus();
      return status === 'granted';
    }
  };

  return {
    ...store,
    requestPermission,
    triggerSystemPrompt,
  };
};
