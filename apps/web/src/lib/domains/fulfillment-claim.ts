import type { SupabaseClient } from '@supabase/supabase-js';

// Serialize domain-purchase fulfillment between the two registrar callers:
// the payments webhook and /api/domains/purchase (dashboard callback). Both
// can observe a completed, unused transaction concurrently — whoever claims
// the transaction row first is the only one allowed to call the registrar,
// preventing duplicate (double-charged) registrations for one payment.
//
// The claim is a conditional UPDATE on transactions.metadata, atomic under
// row locking: the WHERE clause only matches rows that are unclaimed or whose
// claim has gone stale (claimant crashed mid-registration), so exactly one
// concurrent caller gets the row back. Claims MUST be written with a
// service-role client — transactions has no UPDATE policy for merchants, so a
// user-scoped client would silently update zero rows and never win a claim.
//
// A successful registration overwrites metadata (domain_purchased) via the
// caller's existing mark step, which drops the claim fields; a failed attempt
// should release the claim explicitly so the other path (or a retry) can
// fulfill the payment.

export const DOMAIN_FULFILLMENT_CLAIM_STALE_MS = 10 * 60 * 1000;

export interface DomainFulfillmentClaimInput {
  transactionId: string;
  /** Current transaction metadata (spread into the claim update). */
  metadata: Record<string, unknown>;
  /** Which path is claiming, e.g. "webhook" or "purchase_route". */
  claimant: string;
}

export async function claimDomainFulfillment(
  supabase: SupabaseClient,
  { transactionId, metadata, claimant }: DomainFulfillmentClaimInput
): Promise<boolean> {
  const staleBefore = new Date(
    Date.now() - DOMAIN_FULFILLMENT_CLAIM_STALE_MS
  ).toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .update({
      metadata: {
        ...metadata,
        fulfillment_claimed_by: claimant,
        fulfillment_claimed_at: new Date().toISOString(),
      },
    })
    .eq('id', transactionId)
    .or(
      `metadata->>fulfillment_claimed_by.is.null,metadata->>fulfillment_claimed_at.lt."${staleBefore}"`
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to claim domain fulfillment:', error);
    // Fail closed: without a confirmed claim this caller must not touch the
    // registrar, or a transient error could cause a duplicate registration.
    return false;
  }

  return Boolean(data);
}

export async function releaseDomainFulfillmentClaim(
  supabase: SupabaseClient,
  { transactionId, metadata, claimant }: DomainFulfillmentClaimInput
): Promise<void> {
  const released: Record<string, unknown> = { ...metadata };
  delete released.fulfillment_claimed_by;
  delete released.fulfillment_claimed_at;

  const { error } = await supabase
    .from('transactions')
    .update({ metadata: released })
    .eq('id', transactionId)
    .eq('metadata->>fulfillment_claimed_by', claimant)
    .select('id')
    .maybeSingle();

  if (error) {
    // Non-fatal: the stale-claim window lets the other path retry eventually.
    console.error('Failed to release domain fulfillment claim:', error);
  }
}
