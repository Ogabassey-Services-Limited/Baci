import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, maxDuration } from './route';

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mockReconcile = vi.fn();
vi.mock('@/lib/ios-live-build-reconcile', () => ({
  reconcileIosLiveBuild: (...args: unknown[]) => mockReconcile(...args),
}));

const SECRET = 'test-cron-secret';

function cronRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  return new NextRequest('http://localhost:3000/api/cron/ios-live-build-sync', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cron/ios-live-build-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_ADMIN_UPDATES_ENABLED', 'true');
    mockReconcile.mockImplementation((app: 'storefront' | 'admin') =>
      Promise.resolve({
        synced: true,
        app,
        platform: 'ios',
        build: app === 'admin' ? 22 : 360,
        versionString: app === 'admin' ? '2.0.1' : '2.1.360',
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes a maxDuration for backlog-safe execution', () => {
    expect(maxDuration).toBe(60);
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(500);
  });

  it('returns 401 when the bearer token does not match', async () => {
    const response = await GET(cronRequest('Bearer wrong'));
    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('skips every app when the update gate is disabled', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'false');
    vi.stubEnv('MOBILE_ADMIN_UPDATES_ENABLED', 'false');

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([
      { app: 'storefront', skipped: 'updates_disabled' },
      { app: 'admin', skipped: 'updates_disabled' },
    ]);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('passes through a no-op reconcile result per app', async () => {
    mockReconcile.mockResolvedValue({
      synced: false,
      skipped: 'asc_credentials_missing',
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toContainEqual({
      app: 'storefront',
      skipped: 'asc_credentials_missing',
    });
    expect(body.results).toContainEqual({
      app: 'admin',
      skipped: 'asc_credentials_missing',
    });
  });

  it('reports the synced build for each app on success', async () => {
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(mockReconcile).toHaveBeenCalledWith(
      'storefront',
      'app_store_connect_cron'
    );
    expect(mockReconcile).toHaveBeenCalledWith(
      'admin',
      'app_store_connect_cron'
    );
    expect(body.results).toEqual([
      { app: 'storefront', synced: true, build: 360, versionString: '2.1.360' },
      { app: 'admin', synced: true, build: 22, versionString: '2.0.1' },
    ]);
  });

  it('reports one app synced while the other is skipped', async () => {
    vi.stubEnv('MOBILE_ADMIN_UPDATES_ENABLED', 'false');

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(body.results).toEqual([
      { app: 'storefront', synced: true, build: 360, versionString: '2.1.360' },
      { app: 'admin', skipped: 'updates_disabled' },
    ]);
  });

  it('returns 502 only when every app errors', async () => {
    mockReconcile.mockRejectedValue(new Error('asc down'));

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.results).toEqual([
      { app: 'storefront', error: 'sync_failed' },
      { app: 'admin', error: 'sync_failed' },
    ]);
  });

  it('returns 200 when one app errors but another succeeds', async () => {
    mockReconcile.mockImplementation((app: 'storefront' | 'admin') => {
      if (app === 'admin') return Promise.reject(new Error('asc down'));
      return Promise.resolve({
        synced: true,
        app,
        platform: 'ios',
        build: 360,
        versionString: '2.1.360',
      });
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toContainEqual({
      app: 'storefront',
      synced: true,
      build: 360,
      versionString: '2.1.360',
    });
    expect(body.results).toContainEqual({ app: 'admin', error: 'sync_failed' });
  });
});
