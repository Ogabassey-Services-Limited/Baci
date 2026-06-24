import {
  getAppStoreConnectBundleId,
  getAppStoreConnectCredentials,
} from '@/env';
import { fetchLiveAppStoreBuild } from '@/lib/app-store-connect';
import { writeLatestLiveBuild } from '@/lib/mobile-release-gate-store';

/**
 * Reconcile the in-app update gate (mobile_release_gate.ios) with the build that
 * is actually live on the App Store, read from the App Store Connect API.
 *
 * Shared by both triggers: the App Store Connect webhook (primary, fires the
 * moment a version reaches "Ready for Distribution") and the daily cron
 * (self-heal backstop in case a webhook delivery is ever missed). Both resolve
 * the authoritative build from the ASC API rather than trusting any incoming
 * payload, so the write is identical regardless of trigger.
 */

export type IosLiveBuildReconcileResult =
  | { synced: true; platform: 'ios'; build: number; versionString: string }
  | { synced: false; skipped: 'asc_credentials_missing' | 'no_live_version' };

export async function reconcileIosLiveBuild(
  source = 'app_store_connect'
): Promise<IosLiveBuildReconcileResult> {
  const credentials = getAppStoreConnectCredentials();
  if (!credentials) {
    return { synced: false, skipped: 'asc_credentials_missing' };
  }

  const bundleId = getAppStoreConnectBundleId();
  const live = await fetchLiveAppStoreBuild(bundleId, credentials);
  if (!live) {
    return { synced: false, skipped: 'no_live_version' };
  }

  await writeLatestLiveBuild({ platform: 'ios', build: live.build, source });

  return {
    synced: true,
    platform: 'ios',
    build: live.build,
    versionString: live.versionString,
  };
}
