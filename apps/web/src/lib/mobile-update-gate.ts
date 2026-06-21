import type { MobileReleasePolicyPlatform } from '@/schemas/mobile-release-policy';

/**
 * Shared readers for the storefront in-app update gate env vars, used by both
 * the release-policy route (per-request gating) and the update-nudge cron
 * (server-initiated push). Keeping them here avoids drift in the env-var naming
 * and the build-number parsing across the two call sites.
 */

export type MobileUpdatePlatformKey =
  | 'LATEST_VERSION'
  | 'MIN_VERSION'
  | 'STORE_URL'
  | 'LATEST_BUILD'
  | 'MIN_BUILD';

/** Whether the storefront update gate is enabled at all. */
export function readMobileUpdatesEnabled(): boolean {
  const value =
    process.env.MOBILE_STOREFRONT_UPDATES_ENABLED?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

/** Read a `MOBILE_STOREFRONT_<PLATFORM>_<KEY>` env var (trimmed) or null. */
export function readMobilePlatformEnv(
  platform: MobileReleasePolicyPlatform,
  key: MobileUpdatePlatformKey
): string | null {
  return (
    process.env[`MOBILE_STOREFRONT_${platform.toUpperCase()}_${key}`]?.trim() ||
    null
  );
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
