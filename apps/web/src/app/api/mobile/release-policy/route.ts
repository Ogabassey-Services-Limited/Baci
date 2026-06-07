import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const releasePolicyQuerySchema = z.object({
  app: z.literal('storefront'),
  buildNumber: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  nativeVersion: z.string().trim().min(1),
  platform: z.enum(['android', 'ios']),
  runtimeVersion: z.string().trim().min(1),
});

type Platform = z.infer<typeof releasePolicyQuerySchema>['platform'];

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

function readEnabledFlag() {
  const value =
    process.env.MOBILE_STOREFRONT_UPDATES_ENABLED?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

function readPlatformEnv(
  platform: Platform,
  key: 'LATEST_VERSION' | 'MIN_VERSION' | 'STORE_URL'
) {
  return (
    process.env[`MOBILE_STOREFRONT_${platform.toUpperCase()}_${key}`]?.trim() ||
    null
  );
}

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
  const parsedQuery = releasePolicyQuerySchema.safeParse({
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

  if (!readEnabledFlag()) {
    return disabledResponse();
  }

  const { nativeVersion, platform } = parsedQuery.data;
  const minNativeVersion = readPlatformEnv(platform, 'MIN_VERSION');
  const latestNativeVersion = readPlatformEnv(platform, 'LATEST_VERSION');
  const storeUrl = readPlatformEnv(platform, 'STORE_URL');
  const message =
    process.env.MOBILE_STOREFRONT_UPDATE_MESSAGE?.trim() ||
    'A newer version of Ogabassey is available.';

  const nativeUpdateRequired =
    minNativeVersion !== null &&
    compareVersions(nativeVersion, minNativeVersion) < 0;
  const nativeUpdateRecommended =
    nativeUpdateRequired ||
    (latestNativeVersion !== null &&
      compareVersions(nativeVersion, latestNativeVersion) < 0);

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
