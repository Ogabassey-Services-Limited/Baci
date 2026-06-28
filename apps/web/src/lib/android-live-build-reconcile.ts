import {
  getGooglePlayPackageName,
  getGooglePlayServiceAccountJson,
} from '@/env';
import {
  fetchLiveGooglePlayBuild,
  parseGooglePlayServiceAccountJson,
} from '@/lib/google-play';
import { writeLatestLiveBuild } from '@/lib/mobile-release-gate-store';
import type { MobileApp } from '@/schemas/mobile-release-policy';

/**
 * Reconcile the in-app update gate (mobile_release_gate.<app>.android) with
 * the versionCode that is actually published on Google Play production.
 *
 * This is deliberately separate from the Android upload workflow: a successful
 * AAB upload can still be waiting for Play review/processing, so the gate only
 * advances after the Android Publisher API reports the build on the live track.
 */

export type AndroidLiveBuildReconcileResult =
  | {
      synced: true;
      app: MobileApp;
      platform: 'android';
      build: number;
      track: string;
    }
  | {
      synced: false;
      skipped: 'google_play_credentials_missing' | 'no_live_release';
    };

export async function reconcileAndroidLiveBuild(
  app: MobileApp,
  source = 'google_play_live_track'
): Promise<AndroidLiveBuildReconcileResult> {
  const rawCredentials = getGooglePlayServiceAccountJson();
  if (!rawCredentials) {
    return { synced: false, skipped: 'google_play_credentials_missing' };
  }

  const packageName = getGooglePlayPackageName(app);
  const credentials = parseGooglePlayServiceAccountJson(rawCredentials);
  const live = await fetchLiveGooglePlayBuild(packageName, credentials);
  if (!live) {
    return { synced: false, skipped: 'no_live_release' };
  }

  await writeLatestLiveBuild({
    app,
    platform: 'android',
    build: live.build,
    source,
  });

  return {
    synced: true,
    app,
    platform: 'android',
    build: live.build,
    track: live.track,
  };
}
