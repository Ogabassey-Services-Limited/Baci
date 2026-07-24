import { type NextRequest, NextResponse } from 'next/server';
import { readLatestLiveBuild } from '@/lib/mobile-release-gate-store';
import { evaluateNativeUpdateGate } from '@/lib/mobile-release-policy-evaluation';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
  readMobileUpdateMessage,
  readMobileUpdatesEnabled,
} from '@/lib/mobile-update-gate';
import { createClient } from '@/lib/supabase/server';
import { mobileReleasePolicyQuerySchema } from '@/schemas/mobile-release-policy';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

function disabledResponse() {
  return NextResponse.json(
    {
      enabled: false,
      latestNativeVersion: null,
      message: null,
      minNativeVersion: null,
      nativeUpdateRecommended: false,
      nativeUpdateRequired: false,
      storeUrl: null,
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  const parsedQuery = mobileReleasePolicyQuerySchema.safeParse({
    app: request.nextUrl.searchParams.get('app') ?? undefined,
    buildNumber: request.nextUrl.searchParams.get('buildNumber') ?? undefined,
    channel: request.nextUrl.searchParams.get('channel') ?? undefined,
    nativeVersion:
      request.nextUrl.searchParams.get('nativeVersion') ?? undefined,
    platform: request.nextUrl.searchParams.get('platform') ?? undefined,
    runtimeVersion:
      request.nextUrl.searchParams.get('runtimeVersion') ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid release policy query' },
      { headers: NO_STORE_HEADERS, status: 400 }
    );
  }

  const { app, buildNumber, nativeVersion, platform } = parsedQuery.data;

  if (!readMobileUpdatesEnabled(app)) {
    return disabledResponse();
  }

  const minNativeVersion = readMobilePlatformEnv(app, platform, 'MIN_VERSION');
  const latestNativeVersion = readMobilePlatformEnv(
    app,
    platform,
    'LATEST_VERSION'
  );
  const minNativeBuild = parseBuildNumber(
    readMobilePlatformEnv(app, platform, 'MIN_BUILD')
  );
  // DB-first (the store's actual live build, kept current by the live-build
  // reconciler), falling back to the LATEST_BUILD env var. The table has an
  // explicit public RLS read policy, so this public route must use the
  // request-scoped server client instead of a service-role fallback.
  const supabase = await createClient();
  const latestNativeBuild = await readLatestLiveBuild(app, platform, supabase);
  const installedBuild = parseBuildNumber(buildNumber);
  const storeUrl = readMobilePlatformEnv(app, platform, 'STORE_URL');
  const message = readMobileUpdateMessage(app);

  // Evaluation is extracted into a pure, unit-tested module so the S0-B
  // minimum-version gate can be verified in isolation. REQUIRED is an
  // operator-forced floor (MIN_VERSION / MIN_BUILD); RECOMMENDED is driven only
  // by the store's actual live build, never by LATEST_VERSION (which may be set
  // ahead of the live version and would prompt for an unreleased build).
  const { nativeUpdateRequired, nativeUpdateRecommended } =
    evaluateNativeUpdateGate({
      installedBuild,
      latestNativeBuild,
      minNativeBuild,
      minNativeVersion,
      nativeVersion,
    });

  return NextResponse.json(
    {
      enabled: true,
      latestNativeVersion,
      message,
      minNativeVersion,
      nativeUpdateRecommended,
      nativeUpdateRequired,
      storeUrl,
    },
    { headers: NO_STORE_HEADERS }
  );
}
