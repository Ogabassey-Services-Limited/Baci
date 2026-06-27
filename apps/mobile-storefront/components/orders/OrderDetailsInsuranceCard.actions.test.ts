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
});
