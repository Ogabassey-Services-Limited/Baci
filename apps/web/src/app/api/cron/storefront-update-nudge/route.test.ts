import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

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
    mockNotify.mockResolvedValue({
      platform: 'android',
      eligible: 0,
      sent: 0,
      failed: 0,
      errors: [],
    });
  });

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

  it('nudges both platforms when both have a latest build', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', '1');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    vi.stubEnv('MOBILE_STOREFRONT_IOS_LATEST_BUILD', '390');

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

  it('returns 500 when every attempted platform send fails (pages ops)', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    mockNotify.mockRejectedValueOnce(new Error('expo down'));

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    // Only Android was attempted and it failed → total failure → non-2xx so the
    // VPS scheduler (run-web-cron.mjs) exits non-zero and alerts.
    expect(response.status).toBe(500);
    expect(body.results).toContainEqual({
      platform: 'android',
      skipped: 'error',
    });
  });

  it('stays 200 on partial failure so a healthy platform still nudges', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    vi.stubEnv('MOBILE_STOREFRONT_IOS_LATEST_BUILD', '390');
    // Android throws; iOS succeeds (default mockResolvedValue from beforeEach).
    mockNotify.mockRejectedValueOnce(new Error('expo down'));

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toContainEqual({
      platform: 'android',
      skipped: 'error',
    });
  });
});
