import {
  getAppStoreConnectBundleId,
  getAppStoreConnectCredentials,
} from '@/env';
import { fetchLiveAppStoreBuild } from '@/lib/app-store-connect';
import { writeLatestLiveBuild } from '@/lib/mobile-release-gate-store';
import type { MobileApp } from '@/schemas/mobile-release-policy';

/**
 * Reconcile the in-app update gate (mobile_release_gate.<app>.ios) with the
 * build that is actually live on the App Store, read from the App Store Connect
 * API.
 *
 * Shared by both triggers: the App Store Connect webhook (primary, fires the
 * moment a version reaches "Ready for Distribution") and the daily cron
 * (self-heal backstop in case a webhook delivery is ever missed). Both resolve
 * the authoritative build from the ASC API rather than trusting any incoming
 * payload, so the write is identical regardless of trigger. The ASC API key is
 * account-wide, so the same credentials read both apps — only the bundle id
 * differs per app.
 */

export type IosLiveBuildReconcileResult =
  | {
      synced: true;
      app: MobileApp;
      platform: 'ios';
      build: number;
      versionString: string;
    }
  | { synced: false; skipped: 'asc_credentials_missing' | 'no_live_version' };

export async function reconcileIosLiveBuild(
  app: MobileApp,
  source = 'app_store_connect'
): Promise<IosLiveBuildReconcileResult> {
  const credentials = getAppStoreConnectCredentials();
  if (!credentials) {
    return { synced: false, skipped: 'asc_credentials_missing' };
  }

  const bundleId = getAppStoreConnectBundleId(app);
  const live = await fetchLiveAppStoreBuild(bundleId, credentials);
  if (!live) {
    return { synced: false, skipped: 'no_live_version' };
  }

  await writeLatestLiveBuild({
    app,
    platform: 'ios',
    build: live.build,
    source,
  });

  return {
    synced: true,
    app,
    platform: 'ios',
    build: live.build,
    versionString: live.versionString,
  };
}
