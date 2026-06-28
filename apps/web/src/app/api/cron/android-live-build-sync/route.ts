import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { reconcileAndroidLiveBuild } from '@/lib/android-live-build-reconcile';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';
import {
  MOBILE_APPS,
  type MobileApp,
  mobileAppSchema,
} from '@/schemas/mobile-release-policy';

// Manual fallback only - DO NOT enable Vercel Cron for this route.
// Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
//
// Self-heal/backstop for the Android in-app update gate. The admin Android
// release workflow also calls this route after Google Play upload, but the route
// still reads the authoritative Play production track before writing the gate so
// it never prompts for a build that Play has not made downloadable.

export const maxDuration = 60;

type RequestedAppsResult =
  | { apps: MobileApp[]; success: true }
  | { issues: unknown; success: false };

function requestedApps(request: NextRequest): RequestedAppsResult {
  const rawApp = request.nextUrl.searchParams.get('app');
  if (!rawApp) return { apps: [...MOBILE_APPS], success: true };
  const parsed = mobileAppSchema.safeParse(rawApp);
  return parsed.success
    ? { apps: [parsed.data], success: true }
    : { issues: parsed.error.issues, success: false };
}

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

  const requested = requestedApps(request);
  if (!requested.success) {
    return NextResponse.json(
      { error: 'Invalid app', issues: requested.issues },
      { status: 400 }
    );
  }
  const { apps } = requested;

  const results: Record<string, unknown>[] = [];
  let errored = 0;

  for (const app of apps) {
    try {
      const result = await reconcileAndroidLiveBuild(
        app,
        'google_play_live_track_cron'
      );
      if (!result.synced) {
        results.push({ app, skipped: result.skipped });
        continue;
      }

      logger.info({
        message: 'Synced Android live build to update gate',
        app,
        build: result.build,
        track: result.track,
      });
      results.push({
        app,
        synced: true,
        build: result.build,
        track: result.track,
      });
    } catch (error) {
      errored += 1;
      logger.error({
        message: 'android-live-build-sync failed',
        app,
        error: error instanceof Error ? error.message : String(error),
      });
      results.push({ app, error: 'sync_failed' });
    }
  }

  if (errored > 0 && errored === apps.length) {
    return NextResponse.json(
      { error: 'Every Android live-build sync failed', results },
      { status: 502 }
    );
  }

  return NextResponse.json({ results });
}
