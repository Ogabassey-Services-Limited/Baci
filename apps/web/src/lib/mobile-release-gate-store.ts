import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
} from '@/lib/mobile-update-gate';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  MobileApp,
  MobileReleasePolicyPlatform,
} from '@/schemas/mobile-release-policy';

/**
 * DB-backed source of truth for the "latest live build" used by the in-app
 * update gate, keyed per (app, platform). This replaces reading the value
 * straight from a Vercel env var, which Vercel snapshots at deploy time — so an
 * env change only took effect on the next production deploy. A table row read at
 * request time means the gate updates the instant the store goes live (written
 * by the live-build reconciler), with no redeploy.
 *
 * The env var (`MOBILE_<APP>_<PLATFORM>_LATEST_BUILD`) is kept as a fallback
 * and recovery source when the DB row is missing/unreadable. Android can also
 * use a newer env value over a stale DB row because there is no App Store
 * Connect-style live-build reconciler in this branch; iOS DB rows always win
 * when present because they represent the actual App Store live build.
 */

// Short in-process cache so the per-app-open release-policy reads don't hit the
// DB on every request. Per-instance and best-effort; 60s of staleness on a
// once-per-release value is harmless.
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: number | null;
  expiresAt: number;
}

function cacheKey(
  app: MobileApp,
  platform: MobileReleasePolicyPlatform
): string {
  return `${app}:${platform}`;
}

const liveBuildCache = new Map<string, CacheEntry>();

/** Test-only: drop the in-process cache so reads hit the (mocked) DB again. */
export function __resetLiveBuildCache() {
  liveBuildCache.clear();
}

async function readDbLiveBuild(
  client: SupabaseClient,
  app: MobileApp,
  platform: MobileReleasePolicyPlatform
): Promise<number | null> {
  const { data, error } = await client
    .from('mobile_release_gate')
    .select('latest_live_build')
    .eq('app', app)
    .eq('platform', platform)
    .maybeSingle();

  if (error) {
    logger.error({
      message: 'mobile_release_gate read failed',
      app,
      platform,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;
  return parseBuildNumber(String(data.latest_live_build));
}

/**
 * Resolve the latest build live on the store for an (app, platform): DB first,
 * then the `LATEST_BUILD` env var, then null. Cached in-process for
 * {@link CACHE_TTL_MS}.
 */
export async function readLatestLiveBuild(
  app: MobileApp,
  platform: MobileReleasePolicyPlatform,
  client: SupabaseClient
): Promise<number | null> {
  const key = cacheKey(app, platform);
  const now = Date.now();
  const cached = liveBuildCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let value: number | null = null;
  try {
    value = await readDbLiveBuild(client, app, platform);
  } catch (error) {
    logger.error({
      message: 'mobile_release_gate read threw',
      app,
      platform,
      error: error instanceof Error ? error.message : String(error),
    });
    value = null;
  }

  const envValue = parseBuildNumber(
    readMobilePlatformEnv(app, platform, 'LATEST_BUILD')
  );

  if (value === null) {
    value = envValue;
  } else if (platform === 'android' && envValue !== null && envValue > value) {
    value = envValue;
  }

  liveBuildCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * Upsert the latest build live on the store for an (app, platform).
 * Service-role only (the reconciler). Refreshes the in-process cache so a
 * subsequent read in the same instance reflects the new value immediately.
 */
export async function writeLatestLiveBuild(
  params: {
    app: MobileApp;
    platform: MobileReleasePolicyPlatform;
    build: number;
    source: string;
  },
  client?: SupabaseClient
): Promise<void> {
  const { app, platform, build, source } = params;
  const db = client ?? createAdminClient();
  const { error } = await db.from('mobile_release_gate').upsert(
    {
      app,
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

  liveBuildCache.set(cacheKey(app, platform), {
    value: build,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
