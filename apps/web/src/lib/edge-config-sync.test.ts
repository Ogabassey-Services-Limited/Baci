import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { triggerDomainEdgeConfigSync } from './edge-config-sync';

const originalEnv = process.env;

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
      'https://usebaci.com/api/edge-config/sync',
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
    process.env.VERCEL_URL = 'preview-123.vercel.app';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await triggerDomainEdgeConfigSync();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://preview-123.vercel.app/api/edge-config/sync',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('falls back to VERCEL_API_TOKEN when EDGE_CONFIG_SYNC_SECRET is absent', async () => {
    delete process.env.EDGE_CONFIG_SYNC_SECRET;
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.NEXT_PUBLIC_APP_URL = 'https://usebaci.com';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await triggerDomainEdgeConfigSync();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://usebaci.com/api/edge-config/sync',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer vercel-token',
        },
      })
    );
  });
});
