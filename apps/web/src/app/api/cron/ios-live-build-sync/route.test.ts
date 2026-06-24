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
    mockReconcile.mockResolvedValue({
      synced: true,
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
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

  it('skips when the update gate is disabled', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'false');
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();
    expect(body).toEqual({ skipped: 'updates_disabled' });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('passes through a no-op reconcile result', async () => {
    mockReconcile.mockResolvedValue({
      synced: false,
      skipped: 'asc_credentials_missing',
    });
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();
    expect(body).toEqual({ skipped: 'asc_credentials_missing' });
  });

  it('reports the synced build on success', async () => {
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(mockReconcile).toHaveBeenCalledWith('app_store_connect_cron');
    expect(body).toEqual({
      synced: true,
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  it('returns 502 when reconcile throws', async () => {
    mockReconcile.mockRejectedValue(new Error('asc down'));
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe('App Store Connect sync failed');
  });
});
