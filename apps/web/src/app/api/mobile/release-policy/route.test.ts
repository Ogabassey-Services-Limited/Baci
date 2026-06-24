import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The route resolves the latest live build via the DB-backed gate store. Here we
// delegate to the LATEST_BUILD env var (the store's own fallback) so these tests
// stay env-driven and never touch Supabase.
vi.mock('@/lib/mobile-release-gate-store', async () => {
  const { parseBuildNumber, readMobilePlatformEnv } = await vi.importActual<
    typeof import('@/lib/mobile-update-gate')
  >('@/lib/mobile-update-gate');
  return {
    readLatestLiveBuild: async (platform: 'android' | 'ios') =>
      parseBuildNumber(readMobilePlatformEnv(platform, 'LATEST_BUILD')),
  };
});

function makeRequest(query: Record<string, string | undefined>) {
  const url = new URL('http://localhost/api/mobile/release-policy');
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

async function callGet(query: Record<string, string | undefined>) {
  vi.resetModules();
  const { GET } = await import('./route');
  return GET(makeRequest(query));
}

describe('GET /api/mobile/release-policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns disabled with no-store caching when update policy is off', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'false');

    const response = await callGet({
      app: 'storefront',
      platform: 'ios',
      runtimeVersion: '2.0.0',
      nativeVersion: '2.0.0',
      buildNumber: '9',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toEqual({
      enabled: false,
      latestNativeVersion: null,
      message: null,
      minNativeVersion: null,
      nativeUpdateRecommended: false,
      nativeUpdateRequired: false,
      storeUrl: null,
    });
  });

  it('returns 400 for invalid query params', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');

    const response = await callGet({
      app: 'admin',
      platform: 'desktop',
      runtimeVersion: '',
      nativeVersion: '',
      buildNumber: undefined,
      channel: '',
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid release policy query');
  });

  it('requires a native update when installed version is below the platform minimum', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_IOS_MIN_VERSION', '2.1.0');
    vi.stubEnv('MOBILE_STOREFRONT_IOS_LATEST_VERSION', '2.2.0');
    vi.stubEnv(
      'MOBILE_STOREFRONT_IOS_STORE_URL',
      'https://apps.apple.com/app/id6472735367'
    );
    vi.stubEnv(
      'MOBILE_STOREFRONT_UPDATE_MESSAGE',
      'A safer version is available.'
    );

    const response = await callGet({
      app: 'storefront',
      platform: 'ios',
      runtimeVersion: '2.0.0',
      nativeVersion: '2.0.0',
      buildNumber: '9',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      enabled: true,
      latestNativeVersion: '2.2.0',
      message: 'A safer version is available.',
      minNativeVersion: '2.1.0',
      nativeUpdateRecommended: true,
      nativeUpdateRequired: true,
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });
  });

  it('recommends but does not require native update when installed version is below latest only', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_MIN_VERSION', '2.0.0');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_VERSION', '2.1.0');
    vi.stubEnv(
      'MOBILE_STOREFRONT_ANDROID_STORE_URL',
      'https://play.google.com/store/apps/details?id=com.ogabassey.store'
    );

    const response = await callGet({
      app: 'storefront',
      platform: 'android',
      runtimeVersion: '2.0.0',
      nativeVersion: '2.0.1',
      buildNumber: '42',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      enabled: true,
      latestNativeVersion: '2.1.0',
      minNativeVersion: '2.0.0',
      nativeUpdateRecommended: true,
      nativeUpdateRequired: false,
    });
  });

  it('requires a native update when installed build is below the platform minimum build', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_MIN_BUILD', '646');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    vi.stubEnv(
      'MOBILE_STOREFRONT_ANDROID_STORE_URL',
      'https://play.google.com/store/apps/details?id=com.ogabassey.store'
    );

    const response = await callGet({
      app: 'storefront',
      platform: 'android',
      runtimeVersion: '2.0.0',
      // Android marketing version is a constant 2.0.0 across releases, so the
      // build number is the only signal that distinguishes an old install.
      nativeVersion: '2.0.0',
      buildNumber: '600',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      enabled: true,
      nativeUpdateRecommended: true,
      nativeUpdateRequired: true,
      storeUrl:
        'https://play.google.com/store/apps/details?id=com.ogabassey.store',
    });
  });

  it('recommends but does not require a native update when installed build is below latest build only', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');

    const response = await callGet({
      app: 'storefront',
      platform: 'android',
      runtimeVersion: '2.0.0',
      nativeVersion: '2.0.0',
      buildNumber: '600',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      enabled: true,
      nativeUpdateRecommended: true,
      nativeUpdateRequired: false,
    });
  });

  it('does not prompt when installed build is at or above the latest build', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_MIN_BUILD', '600');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');

    const response = await callGet({
      app: 'storefront',
      platform: 'android',
      runtimeVersion: '2.0.0',
      nativeVersion: '2.0.0',
      buildNumber: '646',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      enabled: true,
      nativeUpdateRecommended: false,
      nativeUpdateRequired: false,
    });
  });

  it('ignores build gating when the installed build number is non-numeric', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');

    const response = await callGet({
      app: 'storefront',
      platform: 'android',
      runtimeVersion: '2.0.0',
      nativeVersion: '2.0.0',
      buildNumber: 'not-a-number',
      channel: 'production',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      enabled: true,
      nativeUpdateRecommended: false,
      nativeUpdateRequired: false,
    });
  });
});
