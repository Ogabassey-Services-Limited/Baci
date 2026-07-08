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
    is: vi.fn().mockReturnThis(),
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
  it('returns the claim token and stamps the claimant when the row is won', async () => {
    const { supabase, chain } = createSupabase({
      data: { id: 'txn-1' },
      error: null,
    });

    const outcome = await claimDomainFulfillment(supabase, input);

    expect(outcome.status).toBe('claimed');
    if (outcome.status === 'claimed') {
      expect(outcome.claimedAt).toEqual(expect.any(String));
    }
    expect(chain.update).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        domain: 'shop.com',
        fulfillment_claimed_by: 'webhook',
        fulfillment_claimed_at: expect.any(String),
      }),
    });
    // Already-fulfilled rows are never claimable (webhook replay guard)...
    expect(chain.is).toHaveBeenCalledWith('metadata->>domain_purchased', null);
    // ...and only unclaimed or stale-claimed rows are eligible.
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining('metadata->>fulfillment_claimed_by.is.null')
    );
  });

  it('returns contested when another path already holds the claim', async () => {
    const { supabase } = createSupabase({ data: null, error: null });

    const outcome = await claimDomainFulfillment(supabase, input);

    expect(outcome.status).toBe('contested');
  });

  it('returns error (not contested) when the claim write fails', async () => {
    const { supabase } = createSupabase({
      data: null,
      error: { message: 'network' },
    });

    const outcome = await claimDomainFulfillment(supabase, input);

    expect(outcome.status).toBe('error');
  });
});

describe('releaseDomainFulfillmentClaim', () => {
  it('strips the claim fields and matches the exact claim instance', async () => {
    const { supabase, chain } = createSupabase({ data: null, error: null });

    await releaseDomainFulfillmentClaim(supabase, {
      ...input,
      metadata: {
        ...input.metadata,
        fulfillment_claimed_by: 'webhook',
        fulfillment_claimed_at: '2026-07-08T00:00:00.000Z',
      },
      claimedAt: '2026-07-08T00:00:00.000Z',
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
    // A stale takeover by the same claimant writes a fresh claimed_at; the
    // original attempt's release must not match the newer claim.
    expect(chain.eq).toHaveBeenCalledWith(
      'metadata->>fulfillment_claimed_at',
      '2026-07-08T00:00:00.000Z'
    );
  });
});
