import { describe, expect, it } from 'vitest';
import { computeNegotiationCounterOffer } from '@baci/shared/lib';
import { computeCounterOffer } from './negotiation-modal-pricing';

describe('computeCounterOffer', () => {
  it('re-exports the shared negotiation counter-offer policy', () => {
    expect(computeCounterOffer).toBe(computeNegotiationCounterOffer);
  });
});
