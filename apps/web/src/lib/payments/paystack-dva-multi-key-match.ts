// Phase B — B0 tightened DVA match key (Δ-3, Δ-6, Δ-55, Δ-57).
//
// Pure function: given a list of `order_payment_accounts` candidates
// joined with their orders, plus the verified Paystack webhook context
// (amount, customer email, paid_at), return either a single match, an
// ambiguous multi-match, or no match.
//
// The upstream lookup already filters by `(provider='paystack',
// account_number=<receiver>)` so we only see candidates that share the
// account number. This function applies the remaining B0 predicates:
// amount, customer_email, and the paid_at window:
//
//   paid_at IN [account_created_at,
//               LEAST(account_expires_at, account_created_at + 90 min)]
//
// Lower bound = DVA assignment time (we don't accept payments
// predating the DVA — defensive against ref-replay).
// Upper bound respects Paystack's expires_at if returned, else
// `created_at + 1h DVA countdown + 30min inter-bank settlement grace`
// = 90 minutes total.

const KOBO_TOLERANCE = 1; // ±₦0.01
const NINETY_MINUTES_MS = 90 * 60 * 1000;

export type DvaMatchCandidate = {
  order_id: string;
  merchant_id: string;
  customer_email: string | null;
  // Order total expressed in kobo to match Paystack precision.
  total_kobo: number;
  account_created_at: Date;
  account_expires_at: Date | null;
};

export type DvaMatchContext = {
  // Verified Paystack amount in kobo (data.amount from /transaction/verify).
  verifiedAmountKobo: number;
  // Paystack customer email (data.customer.email from verify).
  customerEmail: string;
  // Verified `data.paid_at` from Paystack.
  paidAt: Date;
};

export type DvaMatchResult =
  | { kind: 'single'; candidate: DvaMatchCandidate }
  | { kind: 'ambiguous'; candidates: DvaMatchCandidate[] }
  | { kind: 'none' };

export function matchPaystackDvaCandidates(
  candidates: readonly DvaMatchCandidate[],
  context: DvaMatchContext
): DvaMatchResult {
  const normalizedContextEmail = normalizeEmail(context.customerEmail);
  const paidAtMs = context.paidAt.getTime();

  const matched = candidates.filter((candidate) => {
    if (
      Math.abs(candidate.total_kobo - context.verifiedAmountKobo) >
      KOBO_TOLERANCE
    ) {
      return false;
    }
    if (normalizeEmail(candidate.customer_email) !== normalizedContextEmail) {
      return false;
    }
    const createdAtMs = candidate.account_created_at.getTime();
    if (paidAtMs < createdAtMs) {
      return false;
    }
    const upperBoundFromGrace = createdAtMs + NINETY_MINUTES_MS;
    const upperBound = candidate.account_expires_at
      ? Math.min(candidate.account_expires_at.getTime(), upperBoundFromGrace)
      : upperBoundFromGrace;
    if (paidAtMs > upperBound) {
      return false;
    }
    return true;
  });

  if (matched.length === 0) return { kind: 'none' };
  if (matched.length === 1) return { kind: 'single', candidate: matched[0] };
  return { kind: 'ambiguous', candidates: matched };
}

function normalizeEmail(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}
