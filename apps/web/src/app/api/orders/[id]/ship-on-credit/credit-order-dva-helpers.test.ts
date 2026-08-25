import { describe, expect, it } from 'vitest';
import { creditOrderDvaHelpers } from './credit-order-dva-helpers';

describe('creditOrderDvaHelpers', () => {
  it('rejects an explicitly expired Paystack account', () => {
    expect(
      creditOrderDvaHelpers.isReusableAccount({
        account_name: 'Old customer',
        account_number: '0123456789',
        assigned_at: '2020-01-01T00:00:00.000Z',
        bank_name: 'Wema Bank',
        expires_at: '2020-01-01T00:30:00.000Z',
        provider: 'paystack',
      })
    ).toBe(false);
  });

  it('accepts a Paystack account with a future explicit expiry', () => {
    expect(
      creditOrderDvaHelpers.isReusableAccount({
        account_name: 'Current customer',
        account_number: '0123456789',
        bank_name: 'Wema Bank',
        expires_at: '2999-01-01T00:00:00.000Z',
        provider: 'paystack',
      })
    ).toBe(true);
  });

  it('splits customer names and supplies safe fallbacks', () => {
    expect(creditOrderDvaHelpers.toCustomerName('Ada Lovelace')).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(creditOrderDvaHelpers.toCustomerName(null)).toEqual({
      firstName: 'Customer',
      lastName: 'User',
    });
  });

  it('maps a persisted DVA to the public response shape', () => {
    expect(
      creditOrderDvaHelpers.toVirtualAccount({
        account_name: 'Baci / Ada',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      })
    ).toEqual({
      account_name: 'Baci / Ada',
      account_number: '1234567890',
      bank_name: 'Paystack-Titan',
    });
  });
});
