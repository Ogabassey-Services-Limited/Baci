import { describe, expect, it } from 'vitest';
import { getCarrierBadge } from './shipping-carriers';

describe('getCarrierBadge', () => {
  it('returns the GIGL badge for GIG carrier names', () => {
    expect(getCarrierBadge('GIG Logistics')).toMatchObject({ label: 'GIGL' });
  });

  it('returns the Topship value badge for Topship carrier names', () => {
    expect(getCarrierBadge('Topship Express')).toMatchObject({
      label: 'Best Value',
    });
  });

  it('returns undefined for carriers without a configured badge', () => {
    expect(getCarrierBadge('DHL')).toBeUndefined();
  });
});
