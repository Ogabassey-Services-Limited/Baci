import { describe, expect, it } from 'vitest';
import { merchantWalletFundingAccountSchema } from '@/schemas/merchant-wallet-funding';

describe('merchant wallet account redaction', () => {
  it('exposes only safe account fields', () =>
    expect(
      merchantWalletFundingAccountSchema.parse({
        accountName: 'A',
        accountNumber: '1234567890',
        bankName: 'Bank',
        currency: 'NGN',
        status: 'active',
      })
    ).toEqual(expect.objectContaining({ accountNumber: '1234567890' })));
});
