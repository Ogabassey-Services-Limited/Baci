import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

const mockNotify = vi.fn();
vi.mock('@/lib/insurance/notify-activate-protection', () => ({
  maybeNotifyActivateProtection: (...args: unknown[]) => mockNotify(...args),
}));

import {
  handlePolicyExpired,
  handlePolicyPurchased,
  handlePolicyRenewed,
  handlePolicyUpdated,
} from './webhook-policy-handlers';

/** A from()/update()/eq()/select()/maybeSingle() chain returning `result`. */
function makePolicyChain(result: { data: unknown; error: unknown }) {
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

  describe('handlePolicyPurchased', () => {
    it('activates the matched policy by mycover_policy_id', async () => {
      const { supabase, calls } = makePolicyChain({
        data: { id: 'row-1', order_id: 'order-1' },
        error: null,
      });

      await handlePolicyPurchased(
        supabase,
        { policy_id: 'pol-1', policy_number: 'MC-9' },
        'policy.activated'
      );

      expect(calls.update).toMatchObject({ status: 'active' });
      expect(calls.eq).toEqual(['mycover_policy_id', 'pol-1']);
    });

    it('throws when the purchase webhook matches no stored policy', async () => {
      const { supabase } = makePolicyChain({ data: null, error: null });

      await expect(
        handlePolicyPurchased(
          supabase,
          { policy_id: 'pol-x' },
          'policy.activated'
        )
      ).rejects.toThrow(/did not match a stored policy/);
    });

    it('rethrows a Supabase error', async () => {
      const { supabase } = makePolicyChain({
        data: null,
        error: { message: 'db down' },
      });

      await expect(
        handlePolicyPurchased(
          supabase,
          { policy_id: 'pol-1' },
          'policy.activated'
        )
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('handlePolicyRenewed', () => {
    it('renews the matched policy by its stored policy id', async () => {
      const { supabase, calls } = makePolicyChain({
        data: { id: 'row-1', order_id: 'order-1' },
        error: null,
      });

      await handlePolicyRenewed(
        supabase,
        { policy_id: 'pol-1', expiration_date: '2027-06-30' },
        'policy.renewed',
        'cfg-secret'
      );

      expect(calls.update).toMatchObject({ status: 'active' });
      expect(calls.eq).toEqual(['mycover_policy_id', 'pol-1']);
    });

    it('throws when the renewal matches no stored policy or identifier', async () => {
      const { supabase } = makePolicyChain({ data: null, error: null });

      await expect(
        handlePolicyRenewed(supabase, {}, 'policy.renewed', '')
      ).rejects.toThrow(/missing stored policy or purchase identifier/);
    });
  });

  describe('handlePolicyUpdated', () => {
    it('applies certificate / policy detail updates', async () => {
      const { supabase, calls } = makePolicyChain({
        data: { id: 'row-1', order_id: 'order-1' },
        error: null,
      });

      await handlePolicyUpdated(supabase, {
        policy_id: 'pol-1',
        certificate_url: 'https://mycover.ai/cert.pdf',
      });

      expect(calls.update).toMatchObject({
        certificate_url: 'https://mycover.ai/cert.pdf',
      });
    });

    it('is a no-op when no policy identifier is present', async () => {
      const supabase = { from: vi.fn() } as unknown as SupabaseClient;

      await handlePolicyUpdated(supabase, {});

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('rethrows a Supabase error', async () => {
      const { supabase } = makePolicyChain({
        data: null,
        error: { message: 'db down' },
      });

      await expect(
        handlePolicyUpdated(supabase, { policy_id: 'pol-1' })
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });
});
