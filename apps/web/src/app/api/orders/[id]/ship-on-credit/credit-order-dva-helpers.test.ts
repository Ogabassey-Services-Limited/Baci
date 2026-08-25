import { describe, expect, it } from 'vitest';
import { creditOrderDvaHelpers } from './credit-order-dva-helpers';

describe('creditOrderDvaHelpers', () => {
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
