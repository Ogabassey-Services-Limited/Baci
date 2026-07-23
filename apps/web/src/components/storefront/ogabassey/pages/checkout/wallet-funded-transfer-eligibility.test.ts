import { describe, expect, it } from 'vitest';
import { isEligibleForWalletFundedBankTransfer } from './wallet-funded-transfer-eligibility';

const eligible = {
  isAuthenticated: true,
  merchantId: 'merchant-1',
  orderCurrency: 'NGN',
  paymentAmount: 5000,
  walletOrderAutoDebitWebEnabled: true,
};

describe('isEligibleForWalletFundedBankTransfer', () => {
  it('accepts a signed-in NGN checkout when the flag is on', () => {
    expect(isEligibleForWalletFundedBankTransfer(eligible)).toBe(true);
  });

  it('is a complete no-op when the dark-launch flag is off', () => {
    expect(
      isEligibleForWalletFundedBankTransfer({
        ...eligible,
        walletOrderAutoDebitWebEnabled: false,
      })
    ).toBe(false);
  });

  it('keeps guests on the order-DVA path', () => {
    expect(
      isEligibleForWalletFundedBankTransfer({
        ...eligible,
        isAuthenticated: false,
      })
    ).toBe(false);
  });

  it('keeps non-NGN orders on the order-DVA path (the wallet ledger is NGN)', () => {
    expect(
      isEligibleForWalletFundedBankTransfer({
        ...eligible,
        orderCurrency: 'USD',
      })
    ).toBe(false);
  });

  it('normalises the order currency before comparing', () => {
    expect(
      isEligibleForWalletFundedBankTransfer({
        ...eligible,
        orderCurrency: ' ngn ',
      })
    ).toBe(true);
  });

  it('rejects a missing merchant id', () => {
    expect(
      isEligibleForWalletFundedBankTransfer({
        ...eligible,
        merchantId: undefined,
      })
    ).toBe(false);
  });

  it('rejects a non-positive or non-finite payable amount', () => {
    expect(
      isEligibleForWalletFundedBankTransfer({ ...eligible, paymentAmount: 0 })
    ).toBe(false);
    expect(
      isEligibleForWalletFundedBankTransfer({
        ...eligible,
        paymentAmount: Number.NaN,
      })
    ).toBe(false);
  });
});
