import { describe, expect, it, vi } from 'vitest';
import { cacheLookupResponse } from './route-cache-helpers';

type CacheUpdateResponse = {
  data: { id: string } | null;
  error: { message: string } | null;
};

describe('cacheLookupResponse', () => {
  function mockCacheUpdate(
    response: CacheUpdateResponse = {
      data: { id: 'lookup-1' },
      error: null,
    }
  ) {
    const single = vi.fn().mockResolvedValue(response);
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));

    return { eq, from, select, single, update };
  }

  it('caches a lookup response when exactly one row is updated', async () => {
    const { eq, from, select, single, update } = mockCacheUpdate();
    const body = {
      code: 'CACHE_TEST',
      error: 'Cache test failed',
      success: false as const,
    };

    await cacheLookupResponse({
      body,
      lookupId: 'lookup-1',
      status: 200,
      supabaseAdmin: { from } as never,
      terminalStatus: 'completed',
    });

    expect(from).toHaveBeenCalledWith('imei_lookups');
    expect(update).toHaveBeenCalledWith({
      cached_response: body,
      cached_status: 200,
      status: 'completed',
    });
    expect(eq).toHaveBeenCalledWith('id', 'lookup-1');
    expect(select).toHaveBeenCalledWith('id');
    expect(single).toHaveBeenCalled();
  });

  it('caches response hash and provider status when supplied', async () => {
    const { update } = mockCacheUpdate();

    await cacheLookupResponse({
      body: {
        code: 'SICKW_UNAVAILABLE',
        error: 'Provider failed',
        success: false,
      },
      lookupId: 'lookup-1',
      responseHash: 'response-hash',
      sickwStatus: 'error',
      status: 502,
      supabaseAdmin: { from: vi.fn(() => ({ update })) } as never,
      terminalStatus: 'refunded_not_found',
    });

    expect(update).toHaveBeenCalledWith({
      cached_response: {
        code: 'SICKW_UNAVAILABLE',
        error: 'Provider failed',
        success: false,
      },
      cached_status: 502,
      response_hash: 'response-hash',
      sickw_status: 'error',
      status: 'refunded_not_found',
    });
  });

  it('throws when the Supabase update returns an error', async () => {
    const { from } = mockCacheUpdate({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(
      cacheLookupResponse({
        body: {
          code: 'CACHE_TEST',
          error: 'Cache test failed',
          success: false,
        },
        lookupId: 'lookup-1',
        status: 200,
        supabaseAdmin: { from } as never,
        terminalStatus: 'completed',
      })
    ).rejects.toThrow('permission denied');
  });

  it('requires the imei_lookups update to affect exactly one row', async () => {
    const { eq, from, select, single, update } = mockCacheUpdate({
      data: null,
      error: {
        message: 'JSON object requested, multiple (or no) rows returned',
      },
    });

    await expect(
      cacheLookupResponse({
        body: {
          code: 'CACHE_TEST',
          error: 'Cache test failed',
          success: false,
        },
        lookupId: 'missing-lookup',
        status: 200,
        supabaseAdmin: { from } as never,
        terminalStatus: 'completed',
      })
    ).rejects.toThrow('Failed to cache IMEI lookup response');

    expect(from).toHaveBeenCalledWith('imei_lookups');
    expect(update).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'missing-lookup');
    expect(select).toHaveBeenCalledWith('id');
    expect(single).toHaveBeenCalled();
  });
});
