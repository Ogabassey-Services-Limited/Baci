import { recordCrashBreadcrumb } from '@/lib/crash-diagnostics';
import { initAdTracking } from './ad-tracking';

const AD_TRACKING_STARTUP_TIMEOUT_MS = 4000;

export async function initializeAdTrackingForStartup(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      initAdTracking(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Ad tracking initialization timed out'));
        }, AD_TRACKING_STARTUP_TIMEOUT_MS);
      }),
    ]);
    recordCrashBreadcrumb('root_layout:ad_tracking_initialized');
  } catch (error) {
    console.error('Ad tracking initialization error:', error);
    recordCrashBreadcrumb('root_layout:ad_tracking_error', {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
