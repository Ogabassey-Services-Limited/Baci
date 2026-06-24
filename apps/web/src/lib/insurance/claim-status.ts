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
    if (s.includes('paid')) return 'paid';
    if (s.includes('approved')) return 'approved';
    if (s.includes('declined') || s.includes('disapprov')) return 'declined';
    if (s.includes('offer') && s.includes('reject')) return 'offer_rejected';
    if (s.includes('offer') && s.includes('accept')) return 'offer_accepted';
    if (s.includes('offer')) return 'offer_sent';
    if (s.includes('repair')) return 'repair_estimate';
    if (s.includes('additional')) return 'additional_info';
    if (s.includes('document')) return 'documented';
    if (s.includes('inspection')) return 'inspection';
    if (s.includes('pending')) return 'pending';
  }

  switch (event) {
    case 'claim.approved':
      return 'approved';
    case 'claim.disapproved':
    case 'claim.rejected':
      return 'declined';
    case 'claim.offer_sent':
      return 'offer_sent';
    case 'claim.offer_rejected':
      return 'offer_rejected';
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
