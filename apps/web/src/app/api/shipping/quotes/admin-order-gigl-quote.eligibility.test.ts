import { describe, expect, it } from 'vitest';
import { isEligibleAdminGiglMerchant } from './admin-order-gigl-quote';

describe('Admin GIGL merchant eligibility', () => {
  it('rejects non-Nigerian merchants before provider use', () => {
    expect(
      isEligibleAdminGiglMerchant({ country: 'IN', payout_currency: 'INR' })
    ).toBe(false);
  });
  it('rejects non-NGN payout currency even for Nigeria', () => {
    expect(
      isEligibleAdminGiglMerchant({ country: 'NG', payout_currency: 'USD' })
    ).toBe(false);
  });
  it('accepts Nigerian NGN merchants', () => {
    expect(
      isEligibleAdminGiglMerchant({ country: 'NG', payout_currency: 'NGN' })
    ).toBe(true);
  });
});
