import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { GET, resetDeadLetterAlertCacheForTests } from './route';

function request() {
  return new Request(
    'https://app.usebaci.com/api/cron/drain-cache-invalidations',
    { headers: { Authorization: 'Bearer cron-secret' } }
  );
}

describe('cache invalidation dead-letter alert cache', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    resetDeadLetterAlertCacheForTests();
    mocks.createServiceClient.mockReturnValue({ rpc });
    rpc.mockImplementation((name: string) => {
      if (name === 'claim_cache_invalidations') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'has_cache_invalidation_dead_letters') {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses an unchanged positive alert during the cache window', async () => {
    const first = await GET(request());
    const second = await GET(request());

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'has_cache_invalidation_dead_letters'
      )
    ).toHaveLength(1);
  });

  it('rechecks after expiry and observes remediation plus a new alert', async () => {
    const alertStates = [true, false, true];
    rpc.mockImplementation((name: string) => {
      if (name === 'claim_cache_invalidations') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'has_cache_invalidation_dead_letters') {
        return Promise.resolve({ data: alertStates.shift(), error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });

    await expect(GET(request())).resolves.toMatchObject({ status: 503 });
    vi.advanceTimersByTime(300_001);
    await expect(GET(request())).resolves.toMatchObject({ status: 200 });
    await expect(GET(request())).resolves.toMatchObject({ status: 503 });

    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'has_cache_invalidation_dead_letters'
      )
    ).toHaveLength(3);
  });
});
