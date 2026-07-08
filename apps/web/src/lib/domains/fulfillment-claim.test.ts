import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  claimDomainFulfillment,
  releaseDomainFulfillmentClaim,
} from './fulfillment-claim';

function createSupabase(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient,
    chain,
  };
}

const input = {
  transactionId: 'txn-1',
  metadata: { transaction_type: 'domain_purchase', domain: 'shop.com' },
  claimant: 'webhook',
};

describe('claimDomainFulfillment', () => {
  it('returns true and stamps the claimant when the row is won', async () => {
    const { supabase, chain } = createSupabase({
      data: { id: 'txn-1' },
      error: null,
    });

    const claimed = await claimDomainFulfillment(supabase, input);

    expect(claimed).toBe(true);
    expect(chain.update).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        domain: 'shop.com',
        fulfillment_claimed_by: 'webhook',
        fulfillment_claimed_at: expect.any(String),
      }),
    });
    // Only unclaimed or stale-claimed rows are eligible.
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining('metadata->>fulfillment_claimed_by.is.null')
    );
  });

  it('returns false when another path already holds the claim', async () => {
    const { supabase } = createSupabase({ data: null, error: null });

    const claimed = await claimDomainFulfillment(supabase, input);

    expect(claimed).toBe(false);
  });

  it('fails closed (false) when the claim update errors', async () => {
    const { supabase } = createSupabase({
      data: null,
      error: { message: 'network' },
    });

    const claimed = await claimDomainFulfillment(supabase, input);

    expect(claimed).toBe(false);
  });
});

describe('releaseDomainFulfillmentClaim', () => {
  it('strips the claim fields and filters by the releasing claimant', async () => {
    const { supabase, chain } = createSupabase({ data: null, error: null });

    await releaseDomainFulfillmentClaim(supabase, {
      ...input,
      metadata: {
        ...input.metadata,
        fulfillment_claimed_by: 'webhook',
        fulfillment_claimed_at: '2026-07-08T00:00:00.000Z',
      },
    });

    expect(chain.update).toHaveBeenCalledWith({
      metadata: {
        transaction_type: 'domain_purchase',
        domain: 'shop.com',
      },
    });
    expect(chain.eq).toHaveBeenCalledWith(
      'metadata->>fulfillment_claimed_by',
      'webhook'
    );
  });
});
