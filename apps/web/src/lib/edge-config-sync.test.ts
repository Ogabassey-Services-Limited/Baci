import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { triggerDomainEdgeConfigSync } from './edge-config-sync';

const originalEnv = process.env;
const SYNC_PATH = '/api/edge-config/sync';

describe('triggerDomainEdgeConfigSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does nothing when no sync auth token is configured', async () => {
    delete process.env.EDGE_CONFIG_SYNC_SECRET;
    delete process.env.VERCEL_API_TOKEN;
    process.env.NEXT_PUBLIC_APP_URL = 'https://usebaci.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await triggerDomainEdgeConfigSync();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to app url when configured', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://usebaci.com/';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await triggerDomainEdgeConfigSync();

    expect(fetchSpy).toHaveBeenCalledWith(
      ['https://usebaci.com', SYNC_PATH].join(''),
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sync-secret',
        },
      })
    );
  });

  it('uses VERCEL_URL when NEXT_PUBLIC_APP_URL is absent', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = 'mock-preview-host';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await triggerDomainEdgeConfigSync();

    const previewOrigin = ['https://', process.env.VERCEL_URL].join('');
    expect(fetchSpy).toHaveBeenCalledWith(
      [previewOrigin, SYNC_PATH].join(''),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('does not call fetch when no origin can be resolved', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await triggerDomainEdgeConfigSync();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs when the sync endpoint returns a non-ok response', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://usebaci.com';
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 503,
        statusText: 'Service Unavailable',
      })
    );

    await triggerDomainEdgeConfigSync();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Edge Config Sync Trigger] Failed to sync',
      expect.objectContaining({
        status: 503,
      })
    );
  });

  it('logs when the sync request throws', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://usebaci.com';
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await triggerDomainEdgeConfigSync();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Edge Config Sync Trigger] Sync request failed',
      expect.objectContaining({
        error: expect.any(Error),
      })
    );
  });

  it('requires EDGE_CONFIG_SYNC_SECRET and warns when only VERCEL_API_TOKEN exists', async () => {
    delete process.env.EDGE_CONFIG_SYNC_SECRET;
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.NEXT_PUBLIC_APP_URL = 'https://usebaci.com';
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await triggerDomainEdgeConfigSync();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Edge Config Sync Trigger] EDGE_CONFIG_SYNC_SECRET is missing; VERCEL_API_TOKEN fallback is no longer used.'
    );
  });
});
