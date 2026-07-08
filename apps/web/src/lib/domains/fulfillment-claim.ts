import type { SupabaseClient } from '@supabase/supabase-js';

// Serialize domain-purchase fulfillment between the two registrar callers:
// the payments webhook and /api/domains/purchase (dashboard callback). Both
// can observe a completed, unused transaction concurrently — whoever claims
// the transaction row first is the only one allowed to call the registrar,
// preventing duplicate (double-charged) registrations for one payment.
//
// Invariant: the registrar is contacted AT MOST ONCE per payment unless a
// previous attempt DEFINITIVELY failed (the registrar answered "no"). Three
// markers on transactions.metadata enforce it, all written atomically via
// conditional UPDATEs:
// - `fulfillment_claimed_by/_at`: the claim. Only unclaimed rows, or rows
//   whose claim went stale BEFORE the registrar was contacted, are claimable.
// - `fulfillment_registrar_attempted_at`: stamped immediately before the
//   registrar call. A stale claim with this marker is NEVER taken over —
//   the attempt's outcome is unknown (crash/timeout mid-call), so retrying
//   risks a duplicate order; those rows are reconciled manually from logs.
//   It is cleared only on a definitive registrar failure.
// - `domain_purchased`: set the moment the registrar succeeds; such rows are
//   never claimable again, and releases never touch them.
//
// All writes MUST use a service-role client — transactions has no UPDATE
// policy for merchants, so a user-scoped client would silently update zero
// rows and never win a claim.

export const DOMAIN_FULFILLMENT_CLAIM_STALE_MS = 10 * 60 * 1000;

export function hasDomainRegistrarProof(domain: {
  domain_type?: string | null;
  go54_order_id?: string | null;
  status?: string | null;
}) {
  const hasRegistrarOrderId =
    typeof domain.go54_order_id === 'string' &&
    domain.go54_order_id.trim().length > 0;

  return (
    hasRegistrarOrderId ||
    (domain.status === 'active' && domain.domain_type === 'purchased')
  );
}

export function getDomainRegistrationFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message.toLowerCase()
    : typeof error === 'string'
      ? error.toLowerCase()
      : JSON.stringify(error ?? '').toLowerCase();
}

export function isTerminalDomainRegistrationFailure(error: unknown) {
  const message = getDomainRegistrationFailureMessage(error);
  const terminalPatterns = [
    'already registered',
    'already taken',
    'domain is unavailable',
    'domain not available',
    'domain unavailable',
    'not available for registration',
    'insufficient balance',
    'insufficient funds',
    'low balance',
    'invalid admin contact',
    'invalid billing contact',
    'invalid contact',
    'invalid domain',
    'invalid email',
    'invalid nameserver',
    'invalid phone',
    'invalid registrant',
    'invalid technical contact',
    'missing required',
    'premium domain',
    'required field',
    'unsupported domain',
    'unsupported tld',
  ];
  const terminalCodes = [
    'already_registered',
    'domain_not_available',
    'domain_unavailable',
    'insufficient_balance',
    'invalid_contact',
    'invalid_domain',
    'premium_domain',
    'unsupported_tld',
  ];

  return [...terminalPatterns, ...terminalCodes].some((pattern) =>
    message.includes(pattern)
  );
}

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
  /** A live claim, an ambiguous registrar attempt, or a fulfilled row. */
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
    // Never re-claim a fulfilled purchase (webhook replay guard).
    .is('metadata->>domain_purchased', null)
    // Unclaimed, or stale WITHOUT a registrar attempt: a stale claim whose
    // registrar outcome is unknown must never be taken over automatically.
    .or(
      `metadata->>fulfillment_claimed_by.is.null,and(metadata->>fulfillment_claimed_at.lt."${staleBefore}",metadata->>fulfillment_registrar_attempted_at.is.null)`
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

/**
 * Stamp the claim with a registrar-attempt marker IMMEDIATELY before calling
 * the registrar. Must succeed before the registrar is contacted: without it a
 * crash mid-call would leave a stale claim that another path could take over
 * and double-order. Returns false (and the caller must NOT contact the
 * registrar) if the stamp could not be confirmed.
 */
export async function markRegistrarAttempted(
  supabase: SupabaseClient,
  {
    transactionId,
    metadata,
    claimant,
    claimedAt,
  }: DomainFulfillmentClaimInput & { claimedAt: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      metadata: {
        ...metadata,
        fulfillment_claimed_by: claimant,
        fulfillment_claimed_at: claimedAt,
        fulfillment_registrar_attempted_at: new Date().toISOString(),
      },
    })
    .eq('id', transactionId)
    .eq('metadata->>fulfillment_claimed_by', claimant)
    .eq('metadata->>fulfillment_claimed_at', claimedAt)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to mark registrar attempt:', error);
    return false;
  }

  return Boolean(data);
}

/**
 * Release a claim so another path (or a retry) may fulfill. ONLY call this
 * when the registrar definitively did NOT register — i.e. before the
 * registrar was contacted, or after it returned an explicit failure. For
 * ambiguous outcomes (exceptions/timeouts mid-call) the claim must be left in
 * place and reconciled manually.
 *
 * Returns false when the release WRITE failed. Callers releasing after a
 * definitive registrar failure must surface that loudly: the row still
 * carries the attempt marker, which blocks every automatic retry, so a
 * silently failed release strands the paid purchase until manual
 * reconciliation.
 */
export async function releaseDomainFulfillmentClaim(
  supabase: SupabaseClient,
  {
    transactionId,
    metadata,
    claimant,
    claimedAt,
  }: DomainFulfillmentClaimInput & { claimedAt: string }
): Promise<boolean> {
  const released: Record<string, unknown> = { ...metadata };
  delete released.fulfillment_claimed_by;
  delete released.fulfillment_claimed_at;
  delete released.fulfillment_registrar_attempted_at;

  const { data, error } = await supabase
    .from('transactions')
    .update({ metadata: released })
    .eq('id', transactionId)
    .eq('metadata->>fulfillment_claimed_by', claimant)
    // Match this exact claim instance: after a stale takeover by the same
    // claimant, the original attempt must not release the newer claim.
    .eq('metadata->>fulfillment_claimed_at', claimedAt)
    // Never overwrite a fulfilled row: the caller's metadata snapshot
    // predates registration and would erase the domain_purchased marker,
    // reopening the row to duplicate registration.
    .is('metadata->>domain_purchased', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to release domain fulfillment claim:', error);
    return false;
  }

  // Zero rows matched: the claim was NOT actually released (the row changed
  // under us — different claim instance, or fulfilled concurrently). Report
  // failure so callers escalate instead of assuming the row is claimable.
  return Boolean(data);
}
