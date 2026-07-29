import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';
import { fetchMerchantIdentityVerified } from './fetch-merchant-identity-verified';

vi.mock('server-only', () => ({}));

function clientWithRpc(result: { data?: unknown; error?: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
  } as unknown as SupabaseClient<Database>;
}

describe('fetchMerchantIdentityVerified', () => {
  it('returns true when the caller-scoped RPC reports verified identity', async () => {
    const supabase = clientWithRpc({ data: true });

    await expect(
      fetchMerchantIdentityVerified(
        supabase,
        '11111111-1111-4111-8111-111111111111'
      )
    ).resolves.toBe(true);

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_merchant_identity_verified',
      { p_merchant_id: '11111111-1111-4111-8111-111111111111' }
    );
  });

  it('returns false when the caller-scoped RPC reports unverified identity', async () => {
    const supabase = clientWithRpc({ data: false });

    await expect(
      fetchMerchantIdentityVerified(
        supabase,
        '11111111-1111-4111-8111-111111111111'
      )
    ).resolves.toBe(false);
  });

  it('returns false when the caller lacks access and the RPC yields no row', async () => {
    const supabase = clientWithRpc({ data: null });

    await expect(
      fetchMerchantIdentityVerified(
        supabase,
        '11111111-1111-4111-8111-111111111111'
      )
    ).resolves.toBe(false);
  });

  it('surfaces an RPC failure without exposing identity details', async () => {
    const supabase = clientWithRpc({
      error: { message: 'rpc unavailable' },
    });

    await expect(
      fetchMerchantIdentityVerified(
        supabase,
        '11111111-1111-4111-8111-111111111111'
      )
    ).rejects.toThrow(
      'Failed to load merchant identity verification: rpc unavailable'
    );
  });
});
