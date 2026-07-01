import { describe, expect, it, jest } from '@jest/globals';
import { resolveInsuranceCardActions } from './OrderDetailsInsuranceCard.actions';

describe('resolveInsuranceCardActions', () => {
  it('shows continue claim for non-terminal existing claims with hosted links', () => {
    expect(
      resolveInsuranceCardActions({
        claimLink: 'https://mycover.ai/purchase?q=claim',
        claimStatus: 'Offer sent',
        isDelivered: true,
        onFileClaim: jest.fn(),
      })
    ).toMatchObject({
      showContinueClaim: true,
      showClaim: false,
    });
  });

  it('treats placeholder pending claim status as unstarted until claim progress exists', () => {
    expect(
      resolveInsuranceCardActions({
        claimLink: 'https://mycover.ai/purchase?q=claim',
        claimStatus: 'pending',
        inspectionStatus: 'completed',
        isDelivered: true,
        onFileClaim: jest.fn(),
      })
    ).toMatchObject({
      showContinueClaim: false,
      showClaim: true,
    });
  });

  it('continues pending claims after stage or comments are present', () => {
    expect(
      resolveInsuranceCardActions({
        claimLink: 'https://mycover.ai/purchase?q=claim',
        claimStage: 'Document review',
        claimStatus: 'pending',
        inspectionStatus: 'completed',
        isDelivered: true,
        onFileClaim: jest.fn(),
      })
    ).toMatchObject({
      showContinueClaim: true,
      showClaim: false,
    });
  });

  it('continues a pending claim that only has claim_progress', () => {
    // MyCover may emit just claim_progress (e.g. claim.submitted) — that is an
    // in-progress claim, not a fresh "File a Claim".
    expect(
      resolveInsuranceCardActions({
        claimLink: 'https://mycover.ai/purchase?q=claim',
        claimProgress: 'submission',
        claimStatus: 'pending',
        inspectionStatus: 'completed',
        isDelivered: true,
        onFileClaim: jest.fn(),
      })
    ).toMatchObject({
      showContinueClaim: true,
      showClaim: false,
    });
  });

  it('hides claim continuation for terminal claims', () => {
    expect(
      resolveInsuranceCardActions({
        claimLink: 'https://mycover.ai/purchase?q=claim',
        claimStatus: '  PAID  ',
        isDelivered: true,
        onFileClaim: jest.fn(),
      })
    ).toMatchObject({
      showContinueClaim: false,
      showClaim: false,
    });
  });

  it('suppresses activation and inspection actions for terminal claims', () => {
    expect(
      resolveInsuranceCardActions({
        claimStatus: 'declined',
        inspectionLink: 'https://mycover.ai/purchase?q=inspect',
        inspectionStatus: 'pending',
        isDelivered: true,
        onCompleteInspection: jest.fn(),
      })
    ).toMatchObject({
      showActivationPending: false,
      showAwaitingDelivery: false,
      showInspection: false,
    });
  });

  it('does not show activation pending when a non-terminal claim already exists without a hosted link', () => {
    expect(
      resolveInsuranceCardActions({
        claimStatus: 'offer_sent',
        inspectionStatus: 'pending',
        isDelivered: true,
      })
    ).toMatchObject({
      showActivationPending: false,
      showAwaitingDelivery: false,
      showClaim: false,
      showContinueClaim: false,
    });
  });

  it('prioritizes an in-progress claim over a stale pending inspection link', () => {
    // Claim webhook landed while inspection.completed was missed: the policy
    // still carries a pending inspection link, but the started claim wins.
    expect(
      resolveInsuranceCardActions({
        claimLink: 'https://mycover.ai/purchase?q=claim',
        claimStatus: 'offer_sent',
        inspectionLink: 'https://mycover.ai/purchase?q=inspect',
        inspectionStatus: 'pending',
        isDelivered: true,
        onCompleteInspection: jest.fn(),
        onFileClaim: jest.fn(),
      })
    ).toMatchObject({
      showContinueClaim: true,
      showInspection: false,
      showActivationPending: false,
    });
  });

  it('falls back to activation pending when the inspection link is not allowlisted', () => {
    // A stored but non-normalizable link (e.g. legacy http:// or unknown host)
    // must not render a dead "Activate Protection" button.
    const result = resolveInsuranceCardActions({
      inspectionLink: 'http://evil.example.com/inspect',
      inspectionStatus: 'pending',
      isDelivered: true,
      onCompleteInspection: jest.fn(),
    });
    expect(result.showInspection).toBe(false);
    expect(result.showActivationPending).toBe(true);
    expect(result.inspectionActionUrl).toBeNull();
  });

  it('still surfaces the inspection button when the link normalizes', () => {
    const result = resolveInsuranceCardActions({
      inspectionLink: 'https://mycover.ai/purchase?q=inspect',
      inspectionStatus: 'pending',
      isDelivered: true,
      onCompleteInspection: jest.fn(),
    });
    expect(result.showInspection).toBe(true);
    expect(result.showActivationPending).toBe(false);
    expect(result.inspectionActionUrl).not.toBeNull();
  });

  it('offers a claim fallback when no hosted claim link was captured', () => {
    // Legacy policy / missed webhook: inspection done, no claim_link stored, but
    // a fallback route is available — surface "File a Claim" instead of hiding.
    const result = resolveInsuranceCardActions({
      claimStatus: 'none',
      inspectionStatus: 'completed',
      isDelivered: true,
      onFileClaimFallback: jest.fn(),
    });
    expect(result.showClaim).toBe(true);
    expect(result.claimActionUrl).toBeNull();
  });

  it('hides the claim action when neither a link nor a fallback is available', () => {
    const result = resolveInsuranceCardActions({
      claimStatus: 'none',
      inspectionStatus: 'completed',
      isDelivered: true,
    });
    expect(result.showClaim).toBe(false);
  });
});
