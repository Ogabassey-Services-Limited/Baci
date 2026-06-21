import { type NextRequest, NextResponse } from 'next/server';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
  readMobileUpdatesEnabled,
} from '@/lib/mobile-update-gate';
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

export function GET(request: NextRequest) {
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

  if (!readMobileUpdatesEnabled()) {
    return disabledResponse();
  }

  const { buildNumber, nativeVersion, platform } = parsedQuery.data;
  const minNativeVersion = readMobilePlatformEnv(platform, 'MIN_VERSION');
  const latestNativeVersion = readMobilePlatformEnv(platform, 'LATEST_VERSION');
  const minNativeBuild = parseBuildNumber(
    readMobilePlatformEnv(platform, 'MIN_BUILD')
  );
  const latestNativeBuild = parseBuildNumber(
    readMobilePlatformEnv(platform, 'LATEST_BUILD')
  );
  const installedBuild = parseBuildNumber(buildNumber);
  const storeUrl = readMobilePlatformEnv(platform, 'STORE_URL');
  const message =
    process.env.MOBILE_STOREFRONT_UPDATE_MESSAGE?.trim() ||
    'A newer version of Ogabassey is available.';

  // Required/recommended is the OR of two independent signals: the marketing
  // version (useful where it increments, e.g. iOS) and the build number (the
  // only signal that moves on every Android release). Either crossing its
  // threshold triggers the prompt.
  const nativeUpdateRequired =
    (minNativeVersion !== null &&
      compareVersions(nativeVersion, minNativeVersion) < 0) ||
    (installedBuild !== null &&
      minNativeBuild !== null &&
      installedBuild < minNativeBuild);
  const nativeUpdateRecommended =
    nativeUpdateRequired ||
    (latestNativeVersion !== null &&
      compareVersions(nativeVersion, latestNativeVersion) < 0) ||
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
