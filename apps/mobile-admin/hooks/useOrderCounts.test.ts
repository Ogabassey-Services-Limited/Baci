import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: supabaseMock.rpc },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('./useBranchScope', () => ({
  useBranchScope: () => ({ scope: { type: 'all' } }),
}));

import { fetchOrderCounts } from './useOrderCounts';

const validCounts = {
  all: 12,
  paid: 5,
  pending: 3,
  processing: 2,
  shipped: 2,
  delivered: 3,
  cancelled: 1,
  returned: 1,
};

describe('fetchOrderCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.rpc.mockResolvedValue({ data: validCounts, error: null });
  });

  it('fetches all order counts with one RPC call', async () => {
    await expect(
      fetchOrderCounts('merchant-1', { type: 'all' })
    ).resolves.toEqual(validCounts);

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_mobile_admin_order_counts',
      {
        p_branch_id: null,
        p_merchant_id: 'merchant-1',
      }
    );
  });

  it('passes the selected branch to the aggregate RPC', async () => {
    await fetchOrderCounts('merchant-1', {
      type: 'branch',
      branchId: '7f9d0e12-0000-4000-8000-000000000101',
    });

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_mobile_admin_order_counts',
      {
        p_branch_id: '7f9d0e12-0000-4000-8000-000000000101',
        p_merchant_id: 'merchant-1',
      }
    );
  });

  it('surfaces aggregate RPC errors', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Count failed' },
    });

    await expect(fetchOrderCounts('merchant-1')).rejects.toThrow(
      'Failed to fetch order counts: Count failed'
    );
  });

  it('rejects malformed aggregate responses', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { ...validCounts, paid: -1 },
      error: null,
    });

    await expect(fetchOrderCounts('merchant-1')).rejects.toThrow();
  });
});
