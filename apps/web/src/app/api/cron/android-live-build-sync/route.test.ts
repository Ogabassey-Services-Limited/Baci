import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, maxDuration } from './route';

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mockReconcile = vi.fn();
vi.mock('@/lib/android-live-build-reconcile', () => ({
  reconcileAndroidLiveBuild: (...args: unknown[]) => mockReconcile(...args),
}));

const SECRET = 'test-cron-secret';

function cronRequest(path = '/api/cron/android-live-build-sync') {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${SECRET}` },
  });
}

describe('GET /api/cron/android-live-build-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', SECRET);
    mockReconcile.mockImplementation((app: 'storefront' | 'admin') =>
      Promise.resolve({
        synced: true,
        app,
        platform: 'android',
        build: app === 'admin' ? 125 : 646,
        track: 'production',
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

    const response = await GET(cronRequest());

    expect(response.status).toBe(500);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/cron/android-live-build-sync',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer wrong' },
        }
      )
    );

    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('reconciles every app by default', async () => {
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledWith(
      'storefront',
      'google_play_live_track_cron'
    );
    expect(mockReconcile).toHaveBeenCalledWith(
      'admin',
      'google_play_live_track_cron'
    );
    expect(body.results).toContainEqual({
      app: 'storefront',
      synced: true,
      build: 646,
      track: 'production',
    });
    expect(body.results).toContainEqual({
      app: 'admin',
      synced: true,
      build: 125,
      track: 'production',
    });
  });

  it('can reconcile only the requested app for release workflow calls', async () => {
    const response = await GET(
      cronRequest('/api/cron/android-live-build-sync?app=admin')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith(
      'admin',
      'google_play_live_track_cron'
    );
    expect(body.results).toEqual([
      { app: 'admin', synced: true, build: 125, track: 'production' },
    ]);
  });

  it('returns 400 with validation details for an invalid app query', async () => {
    const response = await GET(
      cronRequest('/api/cron/android-live-build-sync?app=merchant')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid app');
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: [], code: 'invalid_value' }),
      ])
    );
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('passes through no-op reconcile results', async () => {
    mockReconcile.mockResolvedValue({
      synced: false,
      skipped: 'google_play_credentials_missing',
    });

    const response = await GET(
      cronRequest('/api/cron/android-live-build-sync?app=admin')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([
      { app: 'admin', skipped: 'google_play_credentials_missing' },
    ]);
  });

  it('returns 502 when any requested app errors', async () => {
    mockReconcile.mockImplementation((app: 'storefront' | 'admin') => {
      if (app === 'admin') return Promise.reject(new Error('play down'));
      return Promise.resolve({
        synced: true,
        app,
        platform: 'android',
        build: 646,
        track: 'production',
      });
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.results).toContainEqual({
      app: 'storefront',
      synced: true,
      build: 646,
      track: 'production',
    });
    expect(body.results).toContainEqual({ app: 'admin', error: 'sync_failed' });
  });
});
