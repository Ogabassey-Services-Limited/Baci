import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTopProducts } from './dashboard-top-products';

type RpcCall = { name: string; args: Record<string, unknown> };
type RpcResult = {
  data: Record<string, unknown>[] | null;
  error: Error | null;
};

const mocks = vi.hoisted(() => ({
  calls: [] as RpcCall[],
  result: {
    data: null,
    error: null,
  } as RpcResult,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      mocks.calls.push({ args, name });
      return Promise.resolve(mocks.result);
    },
  },
}));

describe('fetchTopProducts', () => {
  beforeEach(() => {
    mocks.calls = [];
    mocks.result = { data: null, error: null };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads top products through the RPC with branch scope', async () => {
    mocks.result = {
      data: [
        {
          id: 'product-1',
          image_url: 'phone.jpg',
          name: 'Phone',
          price: 200,
          total_revenue: 600,
          total_sold: 3,
        },
      ],
      error: null,
    };

    const products = await fetchTopProducts('merchant-1', 5, {
      branchId: 'branch-1',
      type: 'branch',
    });

    expect(mocks.calls).toEqual([
      {
        args: expect.objectContaining({
          p_branch_id: 'branch-1',
          p_limit: 5,
          p_merchant_id: 'merchant-1',
        }),
        name: 'get_top_products',
      },
    ]);
    expect(products).toEqual([
      {
        id: 'product-1',
        imageUrl: 'phone.jpg',
        name: 'Phone',
        price: 200,
        totalRevenue: 600,
        totalSold: 3,
      },
    ]);
  });

  it('preserves compatibility with legacy revenue and units fields', async () => {
    mocks.result = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          revenue: 600,
          units: 3,
        },
      ],
      error: null,
    };

    await expect(fetchTopProducts('merchant-1')).resolves.toEqual([
      {
        id: 'product-1',
        imageUrl: null,
        name: 'Phone',
        price: 0,
        totalRevenue: 600,
        totalSold: 3,
      },
    ]);
  });

  it('throws RPC failures instead of falling back to client aggregation', async () => {
    mocks.result = {
      data: null,
      error: new Error('rpc unavailable'),
    };

    await expect(fetchTopProducts('merchant-1')).rejects.toThrow(
      'fetchTopProducts RPC failed: rpc unavailable'
    );
  });
});
