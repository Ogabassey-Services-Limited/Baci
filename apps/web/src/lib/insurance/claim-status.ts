/**
 * Normalize MyCover claim state into a stable, UI-mappable token.
 *
 * MyCover reports claim state two ways: a human status string
 * (`data.essential.status`, e.g. "Inspection submitted", "Offer sent", "Paid")
 * and a `resource.action` webhook event name. This module collapses both into a
 * small, stable enum so the storefront, the webhook handler and the polling
 * reconciliation all agree on the same vocabulary.
 */

export type ClaimStatusToken =
  | 'pending'
  | 'inspection'
  | 'documented'
  | 'additional_info'
  | 'repair_estimate'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'approved'
  | 'declined'
  | 'paid';

export function normalizeClaimStatus(
  raw?: string | null,
  event?: string | null
): ClaimStatusToken {
  const s = (raw ?? '').toLowerCase().trim();

  if (s) {
    // "Payment Initiated" means the payout has started but NOT settled — it is
    // NOT terminal, so it must be checked before the paid branch (which would
    // otherwise be reached only via 'settled'/'paid'). Treat it as approved
    // (claim granted, payout processing) so the storefront still offers the
    // claim, matching syncClaimsStatus not treating it as paid.
    if (s.includes('payment initiated')) {
      return 'approved';
    }
    if (s.includes('paid') || s.includes('settled')) {
      return 'paid';
    }
    // "Disapproved"/"Declined" must be checked before "approved" because
    // "disapproved" contains the substring "approved".
    if (s.includes('offer') && s.includes('reject')) return 'offer_rejected';
    if (
      s.includes('declined') ||
      s.includes('disapprov') ||
      s.includes('reject')
    ) {
      return 'declined';
    }
    if (s.includes('approved')) return 'approved';
    if (s.includes('offer') && s.includes('accept')) return 'offer_accepted';
    if (s.includes('offer')) return 'offer_sent';
    if (s.includes('repair')) return 'repair_estimate';
    if (s.includes('additional')) return 'additional_info';
    if (s.includes('document')) return 'documented';
    if (s.includes('inspection')) return 'inspection';
    if (s.includes('pending')) return 'pending';
  }

  switch ((event ?? '').toLowerCase().trim()) {
    case 'claim.approved':
      return 'approved';
    case 'claim.disapproved':
    case 'claim.rejected':
      return 'declined';
    case 'claim.offer_sent':
      return 'offer_sent';
    case 'claim.offer_accepted':
      return 'offer_accepted';
    case 'claim.offer_rejected':
      return 'offer_rejected';
    case 'claim.paid':
      return 'paid';
    default:
      return 'pending';
  }
}

const LABELS: Record<ClaimStatusToken, string> = {
  pending: 'Pending',
  inspection: 'Inspection Submitted',
  documented: 'Documented',
  additional_info: 'More Information Requested',
  repair_estimate: 'Repair Estimate Submitted',
  offer_sent: 'Offer Sent',
  offer_accepted: 'Offer Accepted',
  offer_rejected: 'Offer Rejected',
  approved: 'Approved',
  declined: 'Declined',
  paid: 'Paid',
};

export function claimStatusLabel(token: ClaimStatusToken): string {
  return LABELS[token];
}

const TERMINAL: ReadonlySet<ClaimStatusToken> = new Set<ClaimStatusToken>([
  'paid',
  'declined',
  'offer_rejected',
]);

export function isTerminalClaimStatus(token: ClaimStatusToken): boolean {
  return TERMINAL.has(token);
}
