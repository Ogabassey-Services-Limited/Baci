import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
} from '@/lib/mobile-update-gate';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MobileReleasePolicyPlatform } from '@/schemas/mobile-release-policy';

/**
 * DB-backed source of truth for the "latest live build" used by the in-app
 * update gate. This replaces reading the value straight from a Vercel env var,
 * which Vercel snapshots at deploy time — so an env change only took effect on
 * the next production deploy. A table row read at request time means the gate
 * updates the instant the App Store goes live (written by `ios-live-build-sync`),
 * with no redeploy.
 *
 * The env var (`MOBILE_STOREFRONT_<PLATFORM>_LATEST_BUILD`) is kept as a
 * fallback: it covers Android (whose release workflow still writes it directly
 * on production publish) and acts as a safety net if the DB read fails.
 */

const APP = 'storefront';

// Short in-process cache so the per-app-open release-policy reads don't hit the
// DB on every request. Per-instance and best-effort; 60s of staleness on a
// once-per-release value is harmless.
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: number | null;
  expiresAt: number;
}

const liveBuildCache = new Map<MobileReleasePolicyPlatform, CacheEntry>();

/** Test-only: drop the in-process cache so reads hit the (mocked) DB again. */
export function __resetLiveBuildCache() {
  liveBuildCache.clear();
}

async function readDbLiveBuild(
  client: SupabaseClient,
  platform: MobileReleasePolicyPlatform
): Promise<number | null> {
  const { data, error } = await client
    .from('mobile_release_gate')
    .select('latest_live_build')
    .eq('app', APP)
    .eq('platform', platform)
    .maybeSingle();

  if (error) {
    logger.error({
      message: 'mobile_release_gate read failed',
      platform,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;
  return parseBuildNumber(String(data.latest_live_build));
}

/**
 * Resolve the latest build live on the store for a platform: DB first, then the
 * `LATEST_BUILD` env var, then null. Cached in-process for {@link CACHE_TTL_MS}.
 */
export async function readLatestLiveBuild(
  platform: MobileReleasePolicyPlatform,
  client: SupabaseClient
): Promise<number | null> {
  const now = Date.now();
  const cached = liveBuildCache.get(platform);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let value: number | null = null;
  try {
    value = await readDbLiveBuild(client, platform);
  } catch (error) {
    logger.error({
      message: 'mobile_release_gate read threw',
      platform,
      error: error instanceof Error ? error.message : String(error),
    });
    value = null;
  }

  if (value === null) {
    value = parseBuildNumber(readMobilePlatformEnv(platform, 'LATEST_BUILD'));
  }

  liveBuildCache.set(platform, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * Upsert the latest build live on the store for a platform. Service-role only
 * (the cron reconciler). Refreshes the in-process cache so a subsequent read in
 * the same instance reflects the new value immediately.
 */
export async function writeLatestLiveBuild(
  params: {
    platform: MobileReleasePolicyPlatform;
    build: number;
    source: string;
  },
  client?: SupabaseClient
): Promise<void> {
  const { platform, build, source } = params;
  const db = client ?? createAdminClient();
  const { error } = await db.from('mobile_release_gate').upsert(
    {
      app: APP,
      platform,
      latest_live_build: build,
      source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'app,platform' }
  );

  if (error) {
    throw new Error(`mobile_release_gate upsert failed: ${error.message}`);
  }

  liveBuildCache.set(platform, {
    value: build,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
