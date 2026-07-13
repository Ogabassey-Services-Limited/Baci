import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const select = vi.fn();
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn();

  return {
    createServiceClient: vi.fn(() => ({ from, rpc })),
    from,
    rpc,
    select,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { getLandingMetrics } from './actions';

describe('getLandingMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select
      .mockResolvedValueOnce({ count: 1200, error: null })
      .mockResolvedValueOnce({ count: 5400, error: null });
    mocks.rpc.mockResolvedValue({ data: 250_000_000, error: null });
  });

  it('returns formatted landing metrics on the happy path', async () => {
    const metrics = await getLandingMetrics();

    expect(mocks.from).toHaveBeenCalledWith('merchants');
    expect(mocks.from).toHaveBeenCalledWith('orders');
    expect(mocks.rpc).toHaveBeenCalledWith('get_total_sales');
    expect(metrics).toEqual({
      merchants: 1200,
      orders: 5400,
      sales: '2.5M',
      rating: 4.9,
    });
  });

  it('falls back to zeros when the queries reject', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.select.mockReset();
    mocks.select.mockRejectedValue(new Error('connection refused'));

    try {
      const metrics = await getLandingMetrics();

      expect(metrics).toEqual({
        merchants: 0,
        orders: 0,
        sales: '0',
        rating: 4.9,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
