import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  handleClaimUpdate,
  handleInspectionCompleted,
} from './webhook-claim-inspection-handlers';

describe('MyCover claim and inspection webhook handlers', () => {
  it('ignores post-loss inspection completions for policy activation state', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handleInspectionCompleted(supabase, {
      meta: { category: 'postloss' },
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('marks an approved pre-loss inspection completed and stores the claim link', async () => {
    const calls: { update?: Record<string, unknown> } = {};
    const chain = {
      update: (payload: Record<string, unknown>) => {
        calls.update = payload;
        return chain;
      },
      eq: () => chain,
      select: () => chain,
      maybeSingle: () =>
        Promise.resolve({ data: { id: 'pol-1' }, error: null }),
    };
    const supabase = { from: () => chain } as unknown as SupabaseClient;

    await handleInspectionCompleted(supabase, {
      meta: { category: 'preloss', policy_id: 'pol-1', is_approved: true },
      sdk: { claim_link: 'https://mycover.ai/purchase?q=claim' },
    });

    expect(calls.update).toMatchObject({
      inspection_status: 'completed',
      claim_link: 'https://mycover.ai/purchase?q=claim',
    });
  });

  it('rethrows a Supabase error from the inspection update', async () => {
    const chain = {
      update: () => chain,
      eq: () => chain,
      select: () => chain,
      maybeSingle: () =>
        Promise.resolve({ data: null, error: { message: 'db down' } }),
    };
    const supabase = { from: () => chain } as unknown as SupabaseClient;

    await expect(
      handleInspectionCompleted(supabase, {
        meta: { category: 'preloss', policy_id: 'pol-1', is_approved: true },
      })
    ).rejects.toMatchObject({ message: 'db down' });
  });

  it('ignores claim updates without an explicit policy identifier', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handleClaimUpdate(supabase, {
      event: 'claim.updated',
      status: 'success',
      data: { id: 'claim-id', claim_status: 'approved' },
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  function makeUpdateCapture(result: { data: unknown; error: unknown }) {
    const calls: { update?: Record<string, unknown> } = {};
    const chain = {
      update: (payload: Record<string, unknown>) => {
        calls.update = payload;
        return chain;
      },
      eq: () => chain,
      select: () => chain,
      maybeSingle: () => Promise.resolve(result),
    };
    return {
      calls,
      supabase: { from: () => chain } as unknown as SupabaseClient,
    };
  }

  it('persists data.claim_id as claim_id and flips status to claimed on approval', async () => {
    const { supabase, calls } = makeUpdateCapture({
      data: { id: 'pol-row-1' },
      error: null,
    });

    await handleClaimUpdate(supabase, {
      event: 'claim.approved',
      data: {
        policy_id: 'pol-1',
        claim_id: 'claim-abc',
        essential: { status: 'Approved' },
      },
    });

    expect(calls.update).toMatchObject({
      claim_status: 'approved',
      claim_id: 'claim-abc',
      status: 'claimed',
    });
  });

  it('falls back to data.id for claim_id when claim_id is absent', async () => {
    const { supabase, calls } = makeUpdateCapture({
      data: { id: 'pol-row-1' },
      error: null,
    });

    await handleClaimUpdate(supabase, {
      event: 'claim.updated',
      data: {
        policy_id: 'pol-1',
        id: 'claim-primary-id',
        essential: { status: 'Offer sent' },
      },
    });

    expect(calls.update).toMatchObject({ claim_id: 'claim-primary-id' });
  });

  it('rethrows a Supabase error from the claim update', async () => {
    const { supabase } = makeUpdateCapture({
      data: null,
      error: { message: 'db down' },
    });

    await expect(
      handleClaimUpdate(supabase, {
        event: 'claim.updated',
        data: { policy_id: 'pol-1', essential: { status: 'Offer sent' } },
      })
    ).rejects.toMatchObject({ message: 'db down' });
  });
});
