import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { awardVtuAirtimeLoyaltyPoints } from './vtu-loyalty-points-award';

function createSupabaseMock(
  rpcResult: { data: unknown; error: { message: string } | null } = {
    data: {
      awarded: true,
      new_points_balance: 205,
      points_awarded: 5,
      success: true,
    },
    error: null,
  }
) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as SupabaseClient;
}

const baseRow = {
  customer_cashback: 15,
  customer_id: 'customer-1',
  id: 'vtu-1',
  type: 'airtime' as const,
};

describe('awardVtuAirtimeLoyaltyPoints', () => {
  it('awards one third of customer cashback through the RPC', async () => {
    const metadata: Record<string, unknown> = {};
    const supabase = createSupabaseMock();

    const result = await awardVtuAirtimeLoyaltyPoints({
      metadata,
      row: baseRow,
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'award_vtu_airtime_loyalty_points',
      {
        p_points: 5,
        p_transaction_id: 'vtu-1',
      }
    );
    expect(result).toEqual({
      credited: true,
      earned: 5,
      metadataChanged: true,
      newBalance: 205,
    });
    expect(metadata).toMatchObject({
      loyaltyPointsAwarded: true,
      loyaltyPointsBalance: 205,
      loyaltyPointsEarned: 5,
    });
  });

  it('still calls the RPC when metadata already records the award so the ledger remains authoritative', async () => {
    const metadata: Record<string, unknown> = {
      loyaltyPointsAwarded: true,
      loyaltyPointsBalance: 205,
      loyaltyPointsEarned: 5,
    };
    const supabase = createSupabaseMock({
      data: {
        awarded: false,
        new_points_balance: 205,
        points_awarded: 5,
        reason: 'already_awarded',
        success: true,
      },
      error: null,
    });

    const result = await awardVtuAirtimeLoyaltyPoints({
      metadata,
      row: baseRow,
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'award_vtu_airtime_loyalty_points',
      {
        p_points: 5,
        p_transaction_id: 'vtu-1',
      }
    );
    expect(result).toEqual({
      credited: true,
      earned: 5,
      metadataChanged: false,
      newBalance: 205,
    });
  });

  it('treats an idempotent already_awarded RPC response as credited', async () => {
    const metadata: Record<string, unknown> = {};
    const supabase = createSupabaseMock({
      data: {
        awarded: false,
        new_points_balance: 205,
        points_awarded: 5,
        reason: 'already_awarded',
        success: true,
      },
      error: null,
    });

    const result = await awardVtuAirtimeLoyaltyPoints({
      metadata,
      row: baseRow,
      supabase,
    });

    expect(result).toEqual({
      credited: true,
      earned: 5,
      metadataChanged: true,
      newBalance: 205,
    });
    expect(metadata).toMatchObject({
      loyaltyPointsAwarded: true,
      loyaltyPointsBalance: 205,
      loyaltyPointsEarned: 5,
    });
  });

  it('does not mark metadata awarded when the RPC returns success false', async () => {
    const metadata: Record<string, unknown> = {};
    const supabase = createSupabaseMock({
      data: { error: 'VTU transaction not found', success: false },
      error: null,
    });

    const result = await awardVtuAirtimeLoyaltyPoints({
      metadata,
      row: baseRow,
      supabase,
    });

    expect(result).toEqual({
      credited: false,
      earned: 5,
      metadataChanged: false,
    });
    expect(metadata).toEqual({});
  });

  it('does not mark metadata awarded when the award RPC errors', async () => {
    const metadata: Record<string, unknown> = {};
    const supabase = createSupabaseMock({
      data: null,
      error: { message: 'timeout' },
    });

    const result = await awardVtuAirtimeLoyaltyPoints({
      metadata,
      row: baseRow,
      supabase,
    });

    expect(result).toEqual({
      credited: false,
      earned: 5,
      metadataChanged: false,
    });
    expect(metadata).toEqual({});
  });
});
