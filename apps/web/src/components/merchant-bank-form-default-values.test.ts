import { describe, expect, it } from 'vitest';
import { getMerchantBankFormDefaultValues } from './merchant-bank-form-default-values';

describe('getMerchantBankFormDefaultValues', () => {
  it('preserves manual bank fields only for manual settlement countries', () => {
    const initialData = {
      accountName: 'Jane Doe',
      accountNumber: 'IN-123456789012',
      bankCode: '044',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      autoPayoutEnabled: true,
    };

    expect(getMerchantBankFormDefaultValues(initialData, true)).toEqual({
      accountName: 'Jane Doe',
      accountNumber: 'IN-123456789012',
      autoPayoutEnabled: true,
      bankCode: '044',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });
    expect(getMerchantBankFormDefaultValues(initialData, false)).toMatchObject({
      bankName: '',
      manualBankDetails: false,
    });
  });
});
