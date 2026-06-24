import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { reconcileIosLiveBuild } from '@/lib/ios-live-build-reconcile';
import { logger } from '@/lib/logger';
import { readMobileUpdatesEnabled } from '@/lib/mobile-update-gate';

// Manual fallback only - DO NOT enable Vercel Cron for this route.
// Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
//
// Daily SELF-HEAL backstop for the in-app update gate. The primary trigger is
// the App Store Connect webhook (/api/mobile/appstore-webhook), which fires the
// instant a version goes live. This cron only exists to recover if a webhook
// delivery is ever missed, so it runs once a day rather than polling.

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

  if (!readMobileUpdatesEnabled()) {
    return NextResponse.json({ skipped: 'updates_disabled' });
  }

  try {
    const result = await reconcileIosLiveBuild('app_store_connect_cron');
    if (!result.synced) {
      return NextResponse.json({ skipped: result.skipped });
    }

    logger.info({
      message: 'Synced iOS live build to update gate (cron backstop)',
      build: result.build,
      versionString: result.versionString,
    });

    return NextResponse.json({
      synced: true,
      platform: 'ios',
      build: result.build,
      versionString: result.versionString,
    });
  } catch (error) {
    logger.error({
      message: 'ios-live-build-sync failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'App Store Connect sync failed' },
      { status: 502 }
    );
  }
}
