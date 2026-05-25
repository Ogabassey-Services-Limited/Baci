import { describe, expect, it } from 'vitest';
import { getSavingsPaystackAuthorization } from './customer-savings-paystack-authorization';

describe('getSavingsPaystackAuthorization', () => {
  it('accepts reusable Paystack authorization payloads', () => {
    expect(
      getSavingsPaystackAuthorization({
        authorization: {
          authorization_code: 'AUTH_valid',
          bank: 'Access Bank',
          brand: 'visa',
          card_type: 'visa',
          country_code: 'NG',
          exp_month: '08',
          exp_year: '2030',
          last4: '1234',
          reusable: true,
          signature: 'SIG_valid',
        },
      })
    ).toMatchObject({
      authorization_code: 'AUTH_valid',
      reusable: true,
      signature: 'SIG_valid',
    });
  });

  it('rejects non-reusable or malformed authorizations', () => {
    expect(
      getSavingsPaystackAuthorization({
        authorization: {
          authorization_code: 'AUTH_invalid',
          reusable: false,
          signature: 'SIG_invalid',
        },
      })
    ).toBeNull();
    expect(getSavingsPaystackAuthorization({ authorization: null })).toBeNull();
  });
});
