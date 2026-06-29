import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { handlePolicyExpired } from './webhook-policy-handlers';

describe('MyCover policy webhook handlers', () => {
  it('ignores policy.expired payloads without a policy identifier', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handlePolicyExpired(supabase, {});

    expect(supabase.from).not.toHaveBeenCalled();
  });

  function makeExpireChain(result: { data: unknown; error: unknown }) {
    const calls: { update?: Record<string, unknown>; eq?: [string, unknown] } =
      {};
    const chain = {
      update: (payload: Record<string, unknown>) => {
        calls.update = payload;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        calls.eq = [column, value];
        return chain;
      },
      select: () => chain,
      maybeSingle: () => Promise.resolve(result),
    };
    return {
      calls,
      supabase: { from: () => chain } as unknown as SupabaseClient,
    };
  }

  it('expires the matching policy by mycover_policy_id', async () => {
    const { supabase, calls } = makeExpireChain({
      data: { id: 'pol-row-1' },
      error: null,
    });

    await handlePolicyExpired(supabase, { policy_id: 'pol-1' });

    expect(calls.update).toMatchObject({ status: 'expired' });
    expect(calls.eq).toEqual(['mycover_policy_id', 'pol-1']);
  });

  it('warns (without throwing) when no stored policy matched', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { supabase } = makeExpireChain({ data: null, error: null });

    await handlePolicyExpired(supabase, { policy_id: 'unknown-pol' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('matched no stored policy'),
      'unknown-pol'
    );
    warnSpy.mockRestore();
  });

  it('rethrows a Supabase error from the expire update', async () => {
    const { supabase } = makeExpireChain({
      data: null,
      error: { message: 'db down' },
    });

    await expect(
      handlePolicyExpired(supabase, { policy_id: 'pol-1' })
    ).rejects.toMatchObject({ message: 'db down' });
  });
});
