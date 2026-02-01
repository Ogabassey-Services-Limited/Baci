/**
 * Logout Utility - Centralized logout handler
 * Ensures all cleanup tasks are performed on logout to prevent:
 * - Memory leaks from stale listeners
 * - Data leakage between users
 * - Push notifications sent to logged-out devices
 */

import { clearAdminQueryCache } from '@/lib/query-client';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

/**
 * Performs all necessary cleanup before logout.
 * Call this before supabase.auth.signOut() to ensure complete cleanup.
 *
 * @param unregisterPush - Function to unregister push notifications (from usePushNotifications hook)
 */
export async function performLogoutCleanup(
  unregisterPush?: () => Promise<void>
): Promise<void> {
  if (__DEV__) {
    console.log('[Logout] Starting cleanup...');
  }

  // 1. Unregister push notifications to prevent notifications to logged-out device
  if (unregisterPush) {
    try {
      await unregisterPush();
      if (__DEV__) {
        console.log('[Logout] Push notifications unregistered');
      }
    } catch (error) {
      console.error('[Logout] Failed to unregister push:', error);
    }
  }

  // 2. Cleanup RevenueCat listener to prevent memory leak and data mixing
  try {
    useRevenueCatStore.getState().cleanup();
    if (__DEV__) {
      console.log('[Logout] RevenueCat cleaned up');
    }
  } catch (error) {
    console.error('[Logout] Failed to cleanup RevenueCat:', error);
  }

  // 3. Clear TanStack Query cache to prevent data leakage
  try {
    clearAdminQueryCache();
    if (__DEV__) {
      console.log('[Logout] Query cache cleared');
    }
  } catch (error) {
    console.error('[Logout] Failed to clear query cache:', error);
  }

  if (__DEV__) {
    console.log('[Logout] Cleanup complete');
  }
}
