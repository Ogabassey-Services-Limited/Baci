import type {
  MobileApp,
  MobileReleasePolicyPlatform,
} from '@/schemas/mobile-release-policy';

/**
 * Shared readers for the in-app update gate env vars, used by the release-policy
 * route (per-request gating), the update-nudge cron (server-initiated push) and
 * the live-build reconciler. Keeping them here avoids drift in the env-var
 * naming and the build-number parsing across call sites.
 *
 * Env vars are namespaced per app: `MOBILE_<APP>_<PLATFORM>_<KEY>` (e.g.
 * `MOBILE_STOREFRONT_IOS_LATEST_BUILD`, `MOBILE_ADMIN_ANDROID_STORE_URL`).
 */

export type MobileUpdatePlatformKey =
  | 'LATEST_VERSION'
  | 'MIN_VERSION'
  | 'STORE_URL'
  | 'LATEST_BUILD'
  | 'MIN_BUILD';

/** Whether the update gate is enabled for an app at all. */
export function readMobileUpdatesEnabled(app: MobileApp): boolean {
  const value = process.env[`MOBILE_${app.toUpperCase()}_UPDATES_ENABLED`]
    ?.trim()
    .toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

/** Read a `MOBILE_<APP>_<PLATFORM>_<KEY>` env var (trimmed) or null. */
export function readMobilePlatformEnv(
  app: MobileApp,
  platform: MobileReleasePolicyPlatform,
  key: MobileUpdatePlatformKey
): string | null {
  return (
    process.env[
      `MOBILE_${app.toUpperCase()}_${platform.toUpperCase()}_${key}`
    ]?.trim() || null
  );
}

/** Operator-controlled prompt copy for an app, or a sensible default. */
export function readMobileUpdateMessage(app: MobileApp): string {
  const configured =
    process.env[`MOBILE_${app.toUpperCase()}_UPDATE_MESSAGE`]?.trim();
  if (configured) return configured;
  return app === 'admin'
    ? 'A newer version of the Baci admin app is available.'
    : 'A newer version of Ogabassey is available.';
}

/**
 * Parse a native build number (Android `versionCode`, iOS `CFBundleVersion`)
 * into a non-negative integer, or `null` when absent/malformed.
 *
 * Build numbers are the reliable update signal: CI auto-increments them on every
 * release (Android `versionCode = run_number + base`, iOS `CFBundleVersion =
 * run_number`), whereas the marketing version can stay constant across builds
 * (Android ships a fixed `2.0.0`). The empty/whitespace case is guarded
 * explicitly because `Number('')` is `0`, which would otherwise read as build 0.
 */
export function parseBuildNumber(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
