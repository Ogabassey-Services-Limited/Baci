import type { SupabaseClient } from '@supabase/supabase-js';

// Serialize domain-purchase fulfillment between the two registrar callers:
// the payments webhook and /api/domains/purchase (dashboard callback). Both
// can observe a completed, unused transaction concurrently — whoever claims
// the transaction row first is the only one allowed to call the registrar,
// preventing duplicate (double-charged) registrations for one payment.
//
// The claim is a conditional UPDATE on transactions.metadata, atomic under
// row locking:
// - only rows NOT already fulfilled (`domain_purchased` unset) are eligible,
//   so a replayed webhook can never re-register a purchase whose row is still
//   `pending` because a status update was dropped;
// - only unclaimed rows, or rows whose claim went stale (claimant crashed
//   mid-registration), can be (re)claimed;
// - the returned `fulfillment_claimed_at` stamp is this claim instance's
//   token: release matches claimant AND stamp, so a timed-out original
//   attempt can never release a newer claim taken by the same path.
//
// Claims MUST be written with a service-role client — transactions has no
// UPDATE policy for merchants, so a user-scoped client would silently update
// zero rows and never win a claim.

export const DOMAIN_FULFILLMENT_CLAIM_STALE_MS = 10 * 60 * 1000;

export interface DomainFulfillmentClaimInput {
  transactionId: string;
  /** Current transaction metadata (spread into the claim update). */
  metadata: Record<string, unknown>;
  /** Which path is claiming, e.g. "webhook" or "purchase_route". */
  claimant: string;
}

export type DomainFulfillmentClaimOutcome =
  /** This caller owns fulfillment; `claimedAt` is the release token. */
  | { status: 'claimed'; claimedAt: string }
  /** Another live claim (or an already-fulfilled row) — skip quietly. */
  | { status: 'contested' }
  /** The claim write itself failed — fulfillment state is UNKNOWN, surface it. */
  | { status: 'error' };

export async function claimDomainFulfillment(
  supabase: SupabaseClient,
  { transactionId, metadata, claimant }: DomainFulfillmentClaimInput
): Promise<DomainFulfillmentClaimOutcome> {
  const claimedAt = new Date().toISOString();
  const staleBefore = new Date(
    Date.now() - DOMAIN_FULFILLMENT_CLAIM_STALE_MS
  ).toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .update({
      metadata: {
        ...metadata,
        fulfillment_claimed_by: claimant,
        fulfillment_claimed_at: claimedAt,
      },
    })
    .eq('id', transactionId)
    .is('metadata->>domain_purchased', null)
    .or(
      `metadata->>fulfillment_claimed_by.is.null,metadata->>fulfillment_claimed_at.lt."${staleBefore}"`
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to claim domain fulfillment:', error);
    // Fail closed for the registrar (caller must not register), but let the
    // caller distinguish a transient failure from a genuine contest so it can
    // surface/retry instead of silently dropping a paid purchase.
    return { status: 'error' };
  }

  return data ? { status: 'claimed', claimedAt } : { status: 'contested' };
}

export async function releaseDomainFulfillmentClaim(
  supabase: SupabaseClient,
  {
    transactionId,
    metadata,
    claimant,
    claimedAt,
  }: DomainFulfillmentClaimInput & { claimedAt: string }
): Promise<void> {
  const released: Record<string, unknown> = { ...metadata };
  delete released.fulfillment_claimed_by;
  delete released.fulfillment_claimed_at;

  const { error } = await supabase
    .from('transactions')
    .update({ metadata: released })
    .eq('id', transactionId)
    .eq('metadata->>fulfillment_claimed_by', claimant)
    // Match this exact claim instance: after a stale takeover by the same
    // claimant, the original attempt must not release the newer claim.
    .eq('metadata->>fulfillment_claimed_at', claimedAt)
    .select('id')
    .maybeSingle();

  if (error) {
    // Non-fatal: the stale-claim window lets the other path retry eventually.
    console.error('Failed to release domain fulfillment claim:', error);
  }
}
