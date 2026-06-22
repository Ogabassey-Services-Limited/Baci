import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, maxDuration } from './route';

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mockNotify = vi.fn();
vi.mock('@/lib/expo-push', () => ({
  notifyStorefrontUpdateAvailable: (...args: unknown[]) => mockNotify(...args),
}));

const SECRET = 'test-cron-secret';

function cronRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  return new NextRequest(
    'http://localhost:3000/api/cron/storefront-update-nudge',
    { method: 'GET', headers }
  );
}

describe('GET /api/cron/storefront-update-nudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', SECRET);
    // Default: a clean successful send (1 delivered, throttle stamped).
    mockNotify.mockResolvedValue({
      platform: 'android',
      eligible: 1,
      sent: 1,
      failed: 0,
      errors: [],
      cappedAtLimit: false,
      stampFailed: false,
    });
  });

  // Both platforms fully configured (latest build + store URL).
  function stubBothPlatforms() {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    vi.stubEnv(
      'MOBILE_STOREFRONT_ANDROID_STORE_URL',
      'https://play.google.com/store/apps/details?id=com.ogabassey.store'
    );
    vi.stubEnv('MOBILE_STOREFRONT_IOS_LATEST_BUILD', '390');
    vi.stubEnv(
      'MOBILE_STOREFRONT_IOS_STORE_URL',
      'https://apps.apple.com/app/id6472735367'
    );
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is missing or wrong', async () => {
    expect((await GET(cronRequest())).status).toBe(401);
    expect((await GET(cronRequest('Bearer nope'))).status).toBe(401);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips entirely when updates are disabled', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'false');

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ skipped: 'updates_disabled', results: [] });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips a platform with no configured latest build', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    // Only Android has a latest build configured.
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    vi.stubEnv(
      'MOBILE_STOREFRONT_ANDROID_STORE_URL',
      'https://play.google.com/store/apps/details?id=com.ogabassey.store'
    );

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'android',
        latestBuild: 646,
        storeUrl:
          'https://play.google.com/store/apps/details?id=com.ogabassey.store',
      })
    );
    expect(body.results).toContainEqual({
      platform: 'ios',
      skipped: 'no_latest_build',
    });
  });

  it('skips a platform with a latest build but no store URL', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    // Android: build but no store URL → dead-end "Open store", so skip.
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(body.results).toContainEqual({
      platform: 'android',
      skipped: 'no_store_url',
    });
  });

  it('nudges both platforms when both are fully configured', async () => {
    stubBothPlatforms();

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'android', latestBuild: 646 })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'ios', latestBuild: 390 })
    );
  });

  it('returns 500 when a platform send throws', async () => {
    stubBothPlatforms();
    mockNotify.mockRejectedValueOnce(new Error('expo down'));

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.results).toContainEqual({
      platform: 'android',
      skipped: 'error',
    });
    // iOS still attempted — a failure on one platform doesn't skip the other.
    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when a platform resolves but delivered nothing', async () => {
    stubBothPlatforms();
    // No throw, but Expo/DB failure surfaced as a zero-delivery result.
    mockNotify.mockResolvedValueOnce({
      platform: 'android',
      eligible: 5,
      sent: 0,
      failed: 5,
      errors: ['ExpoError'],
      cappedAtLimit: false,
      stampFailed: false,
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
  });

  it('returns 500 when the throttle stamp failed', async () => {
    stubBothPlatforms();
    // Sent fine, but last_update_push_at write failed → devices stay eligible.
    mockNotify.mockResolvedValueOnce({
      platform: 'android',
      eligible: 5,
      sent: 5,
      failed: 0,
      errors: [],
      cappedAtLimit: false,
      stampFailed: true,
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
  });

  it('exports a long maxDuration so large batches do not 504 mid-send', () => {
    expect(maxDuration).toBe(300);
  });
});
