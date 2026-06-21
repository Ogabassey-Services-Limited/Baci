import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  notifyStorefrontUpdateAvailable,
  type StorefrontUpdateNudgeResult,
} from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
  readMobileUpdatesEnabled,
} from '@/lib/mobile-update-gate';

// Manual fallback only - DO NOT enable Vercel Cron for this route.
// Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
//
// Sends the "update available" push to storefront installs on an older build
// than MOBILE_STOREFRONT_<PLATFORM>_LATEST_BUILD. Each device is throttled
// server-side (last_update_push_at), so running this daily is safe and idempotent.

const PLATFORMS = ['android', 'ios'] as const;

type PlatformOutcome =
  | StorefrontUpdateNudgeResult
  | { platform: (typeof PLATFORMS)[number]; skipped: string };

export async function GET(request: NextRequest) {
  // Auth: fail-closed when CRON_SECRET is not configured.
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!readMobileUpdatesEnabled()) {
    return NextResponse.json({ skipped: 'updates_disabled', results: [] });
  }

  // Optional operator-controlled copy; falls back to the send fn's default.
  const body =
    process.env.MOBILE_STOREFRONT_UPDATE_MESSAGE?.trim() || undefined;

  const results: PlatformOutcome[] = [];
  let attempted = 0;
  let errored = 0;

  for (const platform of PLATFORMS) {
    const latestBuild = parseBuildNumber(
      readMobilePlatformEnv(platform, 'LATEST_BUILD')
    );
    if (latestBuild === null) {
      results.push({ platform, skipped: 'no_latest_build' });
      continue;
    }

    attempted += 1;
    try {
      const result = await notifyStorefrontUpdateAvailable({
        platform,
        latestBuild,
        storeUrl: readMobilePlatformEnv(platform, 'STORE_URL'),
        body,
      });
      results.push(result);
    } catch (error) {
      errored += 1;
      logger.error({
        message: 'Storefront update nudge failed',
        platform,
        error,
      });
      results.push({ platform, skipped: 'error' });
    }
  }

  // If every attempted platform failed, return non-2xx so the VPS scheduler
  // (run-web-cron.mjs exits non-zero) alerts. A partial failure stays 200 so
  // one platform's outage doesn't suppress the other's successful nudge.
  if (attempted > 0 && errored === attempted) {
    return NextResponse.json({ results }, { status: 500 });
  }

  return NextResponse.json({ results });
}
