import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  drain: vi.fn(),
}));
vi.mock('@/lib/drain-storefront-cache-invalidation', () => ({
  drainStorefrontCacheInvalidation: mocks.drain,
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET } from './route';

const claim = {
  attempts: 1,
  claim_token: '11111111-1111-4111-8111-111111111111',
  generation: 2,
  merchant_id: '22222222-2222-4222-8222-222222222222',
  product_slugs: ['cache-phone'],
  related_identifiers: ['shop-one', 'shop.example.com'],
  target_id: 'shop-one',
  target_kind: 'storefront_slug',
};

function request(secret = 'cron-secret') {
  return new Request(
    'https://app.usebaci.com/api/cron/drain-cache-invalidations',
    {
      headers: { Authorization: `Bearer ${secret}` },
    }
  );
}

describe('GET /api/cron/drain-cache-invalidations', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    mocks.createServiceClient.mockReturnValue({ rpc });
    rpc.mockImplementation((name: string) =>
      name === 'claim_cache_invalidations'
        ? Promise.resolve({ data: [claim], error: null })
        : Promise.resolve({ data: true, error: null })
    );
    mocks.drain.mockResolvedValue({ ok: true });
  });

  it('authenticates before claiming and completes only after ordered delivery', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_cache_invalidations', {
      p_batch_size: 5,
      p_worker_id: expect.stringMatching(/^next-cron-/),
    });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'finish_cache_invalidation',
      expect.objectContaining({ p_succeeded: true })
    );
    expect(mocks.drain.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[1]
    );
  });

  it('rejects an invalid secret before constructing privileged authority', async () => {
    const response = await GET(request('wrong'));

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('records a retry when an outer stage is not confirmed', async () => {
    mocks.drain.mockResolvedValue({
      errorCode: 'cloudflare_request_failed',
      ok: false,
      retryAfterSeconds: 120,
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 1,
      completed: 0,
      failed: 1,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'finish_cache_invalidation',
      expect.objectContaining({
        p_error_code: 'cloudflare_request_failed',
        p_retry_after_seconds: 120,
        p_succeeded: false,
      })
    );
  });
});
