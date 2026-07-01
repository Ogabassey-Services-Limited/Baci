import { describe, expect, it } from 'vitest';
import {
  claimStatusLabel,
  isTerminalClaimStatus,
  normalizeClaimStatus,
} from './claim-status';

describe('normalizeClaimStatus', () => {
  it('maps documented MyCover statuses to stable tokens', () => {
    expect(normalizeClaimStatus('Pending')).toBe('pending');
    expect(normalizeClaimStatus('Inspection submitted')).toBe('inspection');
    expect(normalizeClaimStatus('Third party inspection submitted')).toBe(
      'inspection'
    );
    expect(normalizeClaimStatus('Documented')).toBe('documented');
    expect(normalizeClaimStatus('Requested additional information')).toBe(
      'additional_info'
    );
    expect(normalizeClaimStatus('Repair estimate submitted')).toBe(
      'repair_estimate'
    );
    expect(normalizeClaimStatus('Offer sent')).toBe('offer_sent');
    expect(normalizeClaimStatus('Offer accepted')).toBe('offer_accepted');
    expect(normalizeClaimStatus('Offer rejected')).toBe('offer_rejected');
    expect(normalizeClaimStatus('Approved')).toBe('approved');
    expect(normalizeClaimStatus('Declined')).toBe('declined');
    expect(normalizeClaimStatus('Rejected')).toBe('declined');
    // "Disapproved" contains the substring "approved" — must not misclassify.
    expect(normalizeClaimStatus('Disapproved')).toBe('declined');
    expect(normalizeClaimStatus('Offer accepted')).toBe('offer_accepted');
    expect(normalizeClaimStatus('Paid')).toBe('paid');
    expect(normalizeClaimStatus('Payment settled')).toBe('paid');
  });

  it('treats "Payment Initiated" as non-terminal (payout not yet settled)', () => {
    // Same failure mode the syncClaimsStatus payment_status fix prevents, but via
    // the webhook path: an in-flight payout must not close the claim CTA.
    const token = normalizeClaimStatus('Payment Initiated');
    expect(token).toBe('approved');
    expect(isTerminalClaimStatus(token)).toBe(false);
  });

  it('falls back to the event name when status is missing', () => {
    expect(normalizeClaimStatus(undefined, 'claim.submitted')).toBe('pending');
    expect(normalizeClaimStatus(null, 'claim.approved')).toBe('approved');
    expect(normalizeClaimStatus('', 'claim.disapproved')).toBe('declined');
    expect(normalizeClaimStatus(undefined, 'claim.rejected')).toBe('declined');
    expect(normalizeClaimStatus(undefined, 'claim.offer_sent')).toBe(
      'offer_sent'
    );
    expect(normalizeClaimStatus(undefined, 'claim.offer_accepted')).toBe(
      'offer_accepted'
    );
    expect(normalizeClaimStatus(undefined, 'claim.offer_rejected')).toBe(
      'offer_rejected'
    );
    expect(normalizeClaimStatus(undefined, 'claim.paid')).toBe('paid');
  });

  it('defaults to pending for unknown input', () => {
    expect(normalizeClaimStatus(undefined, undefined)).toBe('pending');
    expect(normalizeClaimStatus('something weird')).toBe('pending');
  });
});

describe('claimStatusLabel', () => {
  it('produces human-friendly labels', () => {
    expect(claimStatusLabel('offer_sent')).toBe('Offer Sent');
    expect(claimStatusLabel('paid')).toBe('Paid');
    expect(claimStatusLabel('additional_info')).toBe(
      'More Information Requested'
    );
  });
});

describe('isTerminalClaimStatus', () => {
  it('treats paid / declined / offer_rejected as terminal', () => {
    expect(isTerminalClaimStatus('paid')).toBe(true);
    expect(isTerminalClaimStatus('declined')).toBe(true);
    expect(isTerminalClaimStatus('offer_rejected')).toBe(true);
    expect(isTerminalClaimStatus('pending')).toBe(false);
    expect(isTerminalClaimStatus('offer_sent')).toBe(false);
  });
});
