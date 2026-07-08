import {
  deriveWalletDisplayData,
  normalizeRequiredFundingAccountValue,
} from '@/components/wallet/derive-wallet-display-data';

describe('normalizeRequiredFundingAccountValue', () => {
  it('trims and returns non-empty strings, null otherwise', () => {
    expect(normalizeRequiredFundingAccountValue('  9012345678  ')).toBe(
      '9012345678'
    );
    expect(normalizeRequiredFundingAccountValue('   ')).toBeNull();
    expect(normalizeRequiredFundingAccountValue('')).toBeNull();
    expect(normalizeRequiredFundingAccountValue(null)).toBeNull();
    expect(normalizeRequiredFundingAccountValue(undefined)).toBeNull();
  });
});

describe('deriveWalletDisplayData', () => {
  it('prefers earnings balance and derives total when absent', () => {
    const result = deriveWalletDisplayData({
      earnings_balance: 1500,
      savings_balance: 500,
    });

    expect(result.earningsBalance).toBe(1500);
    expect(result.savingsBalance).toBe(500);
    expect(result.totalBalance).toBe(2000);
  });

  it('falls back to balance when earnings_balance is missing', () => {
    const result = deriveWalletDisplayData({
      balance: 800,
      total_balance: 800,
    });

    expect(result.earningsBalance).toBe(800);
    expect(result.totalBalance).toBe(800);
  });

  it('builds a funding account only when every field is present', () => {
    const complete = deriveWalletDisplayData({
      funding_account: {
        account_name: 'OGB / JOHN DOE',
        account_number: '9012345678',
        bank_name: 'Wema Bank',
        provider: 'paystack',
      },
    });
    expect(complete.fundingAccount).toEqual({
      accountName: 'OGB / JOHN DOE',
      accountNumber: '9012345678',
      bankName: 'Wema Bank',
      provider: 'paystack',
    });

    const partial = deriveWalletDisplayData({
      funding_account: {
        account_number: '9012345678',
        bank_name: 'Wema Bank',
      },
    });
    expect(partial.fundingAccount).toBeNull();
  });

  it('flags quick-save when an active savings goal exists', () => {
    expect(deriveWalletDisplayData({}).showQuickSave).toBe(false);
    expect(
      deriveWalletDisplayData({
        active_savings_goal: { id: 'goal-1' } as never,
      }).showQuickSave
    ).toBe(true);
  });
});
