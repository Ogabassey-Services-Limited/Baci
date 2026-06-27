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

});
