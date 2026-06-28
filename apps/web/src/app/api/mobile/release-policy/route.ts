import { type NextRequest, NextResponse } from 'next/server';
import { readLatestLiveBuild } from '@/lib/mobile-release-gate-store';
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

function parseVersion(version: string | null) {
  if (!version) return null;
  const parts = version
    .trim()
    .split('.')
    .map((part) => Number(part));

  if (
    parts.length === 0 ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return null;
  }

  return parts;
}

function compareVersions(left: string | null, right: string | null) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return 0;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

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

  // REQUIRED is an operator-forced floor: either the marketing version below
  // MIN_VERSION or the build below MIN_BUILD. Both are deliberately set by an
  // operator, so the version signal is safe here.
  const nativeUpdateRequired =
    (minNativeVersion !== null &&
      compareVersions(nativeVersion, minNativeVersion) < 0) ||
    (installedBuild !== null &&
      minNativeBuild !== null &&
      installedBuild < minNativeBuild);
  // RECOMMENDED is driven ONLY by the live build number. The build gate is now
  // sourced from the store's actual live build (mobile_release_gate, kept current
  // by the reconciler), so it never prompts ahead of availability. We do NOT OR
  // in LATEST_VERSION here: that env value can be set ahead of the App Store live
  // version (e.g. a CI bump to 2.1.390 while build 360 is still live), which would
  // recommend an unreleased version and defeat the live-build gate.
  const nativeUpdateRecommended =
    nativeUpdateRequired ||
    (installedBuild !== null &&
      latestNativeBuild !== null &&
      installedBuild < latestNativeBuild);

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
