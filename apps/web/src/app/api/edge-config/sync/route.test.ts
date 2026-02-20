import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEdgeConfigDomainKey,
  getEdgeConfigSlugKey,
} from '@/lib/edge-config-keys';

type DomainRow = {
  domain: string;
  is_primary: boolean;
  domain_type: string;
  merchants: { slug: string } | null;
};

const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateServiceClient = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

import { POST } from './route';

const originalEnv = process.env;

function makeRequest(token?: string): Request {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return new Request('https://example.com/api/edge-config/sync', {
    method: 'POST',
    headers,
  });
}

function mockDomainsQuery(data: DomainRow[] | null, error: unknown = null) {
  mockEq.mockResolvedValue({ data, error });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockCreateServiceClient.mockReturnValue({ from: mockFrom });
}

describe('POST /api/edge-config/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    delete process.env.EDGE_CONFIG_ID;
    delete process.env.EDGE_CONFIG;
    delete process.env.EDGE_CONFIG_SYNC_SECRET;
    delete process.env.VERCEL_API_TOKEN;

    mockDomainsQuery([]);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns 500 when no sync token is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Server misconfigured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization token is invalid', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.EDGE_CONFIG_ID = 'ecfg_test_invalid_auth';

    const response = await POST(makeRequest('wrong-token'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 500 when VERCEL_API_TOKEN is absent even if EDGE_CONFIG_SYNC_SECRET is valid', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    delete process.env.VERCEL_API_TOKEN;
    process.env.EDGE_CONFIG_ID = 'ecfg_missing_vercel_token';

    mockDomainsQuery([]);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('unauthorized', { status: 401 }));

    const response = await POST(makeRequest('sync-secret'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(String(body.error)).toContain('VERCEL_API_TOKEN');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('syncs mappings and deletes stale tenant keys', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.EDGE_CONFIG_ID = 'ecfg_direct_123';

    mockDomainsQuery([
      {
        domain: 'shop-one.com',
        is_primary: true,
        domain_type: 'custom',
        merchants: { slug: 'merchant-one' },
      },
      {
        domain: 'shop-alt.com',
        is_primary: false,
        domain_type: 'custom',
        merchants: { slug: 'merchant-one' },
      },
      {
        domain: 'shop-two.com.ng',
        is_primary: true,
        domain_type: 'purchased',
        merchants: { slug: 'merchant-two' },
      },
      {
        domain: 'subdomain.usebaci.com',
        is_primary: true,
        domain_type: 'subdomain',
        merchants: { slug: 'ignore-me' },
      },
    ]);

    const existingItems = [
      { key: getEdgeConfigDomainKey('shop-one.com') },
      { key: getEdgeConfigSlugKey('merchant-one') },
      { key: 'domain_stale_example_com' },
      { key: 'slug_stale-store' },
      { key: 'other_config_key' },
    ];

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(existingItems), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await POST(makeRequest('sync-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        domainMappings: 3,
        redirectMappings: 2,
        deletedMappings: 2,
        synced: 7,
      })
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.vercel.com/v1/edge-config/ecfg_direct_123/items',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.vercel.com/v1/edge-config/ecfg_direct_123/items',
      expect.objectContaining({
        method: 'PATCH',
      })
    );

    const firstOptions = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const secondOptions = fetchSpy.mock.calls[1]?.[1] as RequestInit;
    expect(firstOptions.signal).toBeInstanceOf(AbortSignal);
    expect(secondOptions.signal).toBeInstanceOf(AbortSignal);

    const patchBody = JSON.parse(String(secondOptions.body)) as {
      items: Array<{ operation: string; key: string; value?: string }>;
    };

    expect(patchBody.items).toEqual(
      expect.arrayContaining([
        {
          operation: 'upsert',
          key: getEdgeConfigDomainKey('shop-one.com'),
          value: 'merchant-one',
        },
        {
          operation: 'upsert',
          key: getEdgeConfigDomainKey('shop-alt.com'),
          value: 'merchant-one',
        },
        {
          operation: 'upsert',
          key: getEdgeConfigDomainKey('shop-two.com.ng'),
          value: 'merchant-two',
        },
        {
          operation: 'upsert',
          key: getEdgeConfigSlugKey('merchant-one'),
          value: 'shop-one.com',
        },
        {
          operation: 'upsert',
          key: getEdgeConfigSlugKey('merchant-two'),
          value: 'shop-two.com.ng',
        },
        { operation: 'delete', key: 'domain_stale_example_com' },
        { operation: 'delete', key: 'slug_stale-store' },
      ])
    );
  });

  it('uses EDGE_CONFIG connection URL when EDGE_CONFIG_ID is absent', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.EDGE_CONFIG = 'https://example.com/ecfg_from_connection_url';

    mockDomainsQuery([]);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const response = await POST(makeRequest('vercel-token'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        synced: 0,
      })
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.vercel.com/v1/edge-config/ecfg_from_connection_url/items',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns 500 when fetching existing Edge Config items fails', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.EDGE_CONFIG_ID = 'ecfg_fetch_error';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('upstream unavailable', { status: 502 })
    );

    const response = await POST(makeRequest('sync-secret'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch Edge Config items' });
  });

  it('returns 500 when patching Edge Config items fails', async () => {
    process.env.EDGE_CONFIG_SYNC_SECRET = 'sync-secret';
    process.env.VERCEL_API_TOKEN = 'vercel-token';
    process.env.EDGE_CONFIG_ID = 'ecfg_patch_error';

    mockDomainsQuery([
      {
        domain: 'shop-one.com',
        is_primary: true,
        domain_type: 'custom',
        merchants: { slug: 'merchant-one' },
      },
    ]);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('patch failed', { status: 500 }));

    const response = await POST(makeRequest('sync-secret'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update Edge Config' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
