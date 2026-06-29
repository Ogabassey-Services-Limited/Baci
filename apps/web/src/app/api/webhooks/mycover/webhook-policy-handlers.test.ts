import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { handlePolicyExpired } from './webhook-policy-handlers';

describe('MyCover policy webhook handlers', () => {
  it('ignores policy.expired payloads without a policy identifier', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handlePolicyExpired(supabase, {});

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('expires the matching policy by mycover_policy_id', async () => {
    const calls: { update?: Record<string, unknown>; eq?: [string, unknown] } =
      {};
    const chain = {
      update: (payload: Record<string, unknown>) => {
        calls.update = payload;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        calls.eq = [column, value];
        return Promise.resolve({ error: null });
      },
    };
    const supabase = { from: () => chain } as unknown as SupabaseClient;

    await handlePolicyExpired(supabase, { policy_id: 'pol-1' });

    expect(calls.update).toMatchObject({ status: 'expired' });
    expect(calls.eq).toEqual(['mycover_policy_id', 'pol-1']);
  });

  it('rethrows a Supabase error from the expire update', async () => {
    const chain = {
      update: () => chain,
      eq: () => Promise.resolve({ error: { message: 'db down' } }),
    };
    const supabase = { from: () => chain } as unknown as SupabaseClient;

    await expect(
      handlePolicyExpired(supabase, { policy_id: 'pol-1' })
    ).rejects.toMatchObject({ message: 'db down' });
  });
});
