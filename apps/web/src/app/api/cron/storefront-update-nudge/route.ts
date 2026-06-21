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

// A real backlog can send up to the per-platform cap (5k tokens) of chunked
// Expo + DB calls, so allow well beyond the default function duration to avoid
// a 504 before tokens are stamped (which would re-send next run).
export const maxDuration = 300;

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
  let errored = 0;

  for (const platform of PLATFORMS) {
    const latestBuild = parseBuildNumber(
      readMobilePlatformEnv(platform, 'LATEST_BUILD')
    );
    if (latestBuild === null) {
      results.push({ platform, skipped: 'no_latest_build' });
      continue;
    }

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

  // Any platform send that threw is a real delivery failure for that platform —
  // return non-2xx so run-web-cron.mjs exits non-zero and the schedule alerts.
  // Successful platforms' sends already persisted (and stamped their throttle),
  // so surfacing the failure doesn't undo that work; it just gets it noticed.
  if (errored > 0) {
    return NextResponse.json({ results }, { status: 500 });
  }

  return NextResponse.json({ results });
}
