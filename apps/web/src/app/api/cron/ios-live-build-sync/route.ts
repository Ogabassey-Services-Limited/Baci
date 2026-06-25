import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { reconcileIosLiveBuild } from '@/lib/ios-live-build-reconcile';
import { logger } from '@/lib/logger';
import { readMobileUpdatesEnabled } from '@/lib/mobile-update-gate';
import { MOBILE_APPS } from '@/schemas/mobile-release-policy';

// Manual fallback only - DO NOT enable Vercel Cron for this route.
// Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
//
// Daily SELF-HEAL backstop for the in-app update gate, across every app. The
// primary trigger is the per-app App Store Connect webhook
// (/api/mobile/appstore-webhook), which fires the instant a version goes live.
// This cron only exists to recover if a webhook delivery is ever missed, so it
// runs once a day rather than polling.

export const maxDuration = 60;

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

  const results: Record<string, unknown>[] = [];
  let errored = 0;

  for (const app of MOBILE_APPS) {
    if (!readMobileUpdatesEnabled(app)) {
      results.push({ app, skipped: 'updates_disabled' });
      continue;
    }

    try {
      const result = await reconcileIosLiveBuild(app, 'app_store_connect_cron');
      if (!result.synced) {
        results.push({ app, skipped: result.skipped });
        continue;
      }

      logger.info({
        message: 'Synced iOS live build to update gate (cron backstop)',
        app,
        build: result.build,
        versionString: result.versionString,
      });
      results.push({
        app,
        synced: true,
        build: result.build,
        versionString: result.versionString,
      });
    } catch (error) {
      errored += 1;
      logger.error({
        message: 'ios-live-build-sync failed',
        app,
        error: error instanceof Error ? error.message : String(error),
      });
      results.push({ app, error: 'sync_failed' });
    }
  }

  // 502 only when every attempted app errored, so a single app's ASC hiccup
  // doesn't mask the others' success in the cron's exit status.
  const status = errored > 0 && errored === MOBILE_APPS.length ? 502 : 200;
  return NextResponse.json({ results }, { status });
}
