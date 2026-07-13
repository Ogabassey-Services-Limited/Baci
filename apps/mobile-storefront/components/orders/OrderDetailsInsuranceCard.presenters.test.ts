import { describe, expect, it } from '@jest/globals';
import {
  resolveDisplayClaimLabel,
  resolvePolicyStatusColors,
} from './OrderDetailsInsuranceCard.presenters';
import { INSURANCE_COLORS } from './OrderDetailsInsuranceCard.styles';

describe('resolvePolicyStatusColors', () => {
  it('maps active and pending to their palettes', () => {
    expect(resolvePolicyStatusColors('active')).toBe(INSURANCE_COLORS.active);
    expect(resolvePolicyStatusColors(' Pending ')).toBe(
      INSURANCE_COLORS.pending
    );
  });

  it('routes terminal/unknown states to the neutral inactive palette', () => {
    expect(resolvePolicyStatusColors('expired')).toBe(
      INSURANCE_COLORS.inactive
    );
    expect(resolvePolicyStatusColors('cancelled')).toBe(
      INSURANCE_COLORS.inactive
    );
    expect(resolvePolicyStatusColors(null)).toBe(INSURANCE_COLORS.inactive);
  });
});

describe('resolveDisplayClaimLabel', () => {
  it('suppresses bare placeholder statuses', () => {
    expect(resolveDisplayClaimLabel(null, 'none')).toBe('');
    expect(resolveDisplayClaimLabel(null, 'pending')).toBe('');
    expect(resolveDisplayClaimLabel(undefined, undefined)).toBe('');
  });

  it('humanizes a real status and prefers the stage', () => {
    expect(resolveDisplayClaimLabel(null, 'offer_sent')).toBe('offer sent');
    expect(resolveDisplayClaimLabel('Document review', 'pending')).toBe(
      'Document review'
    );
  });
});
