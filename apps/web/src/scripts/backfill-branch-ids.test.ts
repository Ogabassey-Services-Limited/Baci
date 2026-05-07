import { describe, expect, it, vi } from 'vitest';
import {
  applyBranchBackfill,
  decideBranchBackfill,
  evaluateMerchantBranchBackfill,
} from '@/scripts/backfill-branch-ids';

const merchantId = 'merchant-1';
const branchId = 'branch-1';

function createSupabaseMock(branches: unknown[]) {
  const calls: Array<{
    args: unknown[];
    method: string;
    table: string | null;
  }> = [];

  const createQuery = (table: string) => {
    const query = {
      select: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'select', args });
        return query;
      }),
      update: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'update', args });
        return query;
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'eq', args });
        return query;
      }),
      is: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'is', args });
        return query;
      }),
      then: (
        resolve: (value: {
          count?: number;
          data?: unknown[];
          error: null;
        }) => unknown
      ) => {
        const result =
          table === 'branches'
            ? { data: branches, error: null }
            : { count: 3, error: null };
        return Promise.resolve(result).then(resolve);
      },
    };

    return query;
  };

  return {
    calls,
    supabase: {
      from: vi.fn((table: string) => createQuery(table)),
      rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
        calls.push({ table: null, method: 'rpc', args: [fn, args] });
        return Promise.resolve({
          data: [
            {
              orders_count: 3,
              variant_inventory_count: 3,
              expenses_count: 3,
            },
          ],
          error: null,
        });
      }),
    },
  };
}

describe('decideBranchBackfill', () => {
  it('assigns the single active branch', () => {
    expect(
      decideBranchBackfill(merchantId, [
        { id: branchId, merchant_id: merchantId, active: true },
      ])
    ).toEqual({
      action: 'assign_single_active_branch',
      merchantId,
      branchId,
    });
  });

  it('skips merchants with multiple active branches', () => {
    expect(
      decideBranchBackfill(merchantId, [
        { id: branchId, merchant_id: merchantId, active: true },
        { id: 'branch-2', merchant_id: merchantId, active: true },
      ])
    ).toEqual({
      action: 'skip_multiple_active_branches',
      merchantId,
      activeBranchCount: 2,
    });
  });

  it('skips merchants with no active branches', () => {
    expect(decideBranchBackfill(merchantId, [])).toEqual({
      action: 'skip_no_active_branch',
      merchantId,
    });
  });
});

describe('evaluateMerchantBranchBackfill', () => {
  it('does not update rows during dry run', async () => {
    const { calls, supabase } = createSupabaseMock([
      { id: branchId, merchant_id: merchantId, active: true },
    ]);

    const result = await evaluateMerchantBranchBackfill(
      supabase,
      merchantId,
      { apply: false }
    );

    expect(result).toMatchObject({
      dryRun: true,
      decision: {
        action: 'assign_single_active_branch',
        merchantId,
        branchId,
      },
      updates: null,
    });
    expect(calls.some((call) => call.method === 'update')).toBe(false);
  });

  it('updates branch-scoped tables through one atomic RPC', async () => {
    const { calls, supabase } = createSupabaseMock([]);

    const updates = await applyBranchBackfill(supabase, {
      action: 'assign_single_active_branch',
      merchantId,
      branchId,
    });

    expect(updates).toEqual({
      orders: 3,
      variantInventory: 3,
      expenses: 3,
    });
    expect(calls).toContainEqual({
      table: null,
      method: 'rpc',
      args: [
        'backfill_branch_scope_for_single_active_branch',
        {
          p_branch_id: branchId,
          p_merchant_id: merchantId,
        },
      ],
    });
    expect(calls.some((call) => call.method === 'update')).toBe(false);
  });

  it('throws when the atomic backfill RPC fails', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      }),
    };

    await expect(
      applyBranchBackfill(supabase, {
        action: 'assign_single_active_branch',
        merchantId,
        branchId,
      })
    ).rejects.toThrow('Failed to backfill branch ids: permission denied');
  });

  it('throws when the atomic backfill RPC returns invalid counts', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            orders_count: '3',
            variant_inventory_count: 3,
            expenses_count: 3,
          },
        ],
        error: null,
      }),
    };

    await expect(
      applyBranchBackfill(supabase, {
        action: 'assign_single_active_branch',
        merchantId,
        branchId,
      })
    ).rejects.toThrow('Branch backfill RPC returned invalid update counts');
  });
});
