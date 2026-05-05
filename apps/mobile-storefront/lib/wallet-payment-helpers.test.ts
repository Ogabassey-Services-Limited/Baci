import {
  buildWalletOrderFields,
  isWalletFullyPaidOrder,
  type WalletSelection,
} from './wallet-payment-helpers';

describe('isWalletFullyPaidOrder', () => {
  // Pin the rule that drives the full-wallet bypass branch in checkout.tsx:
  // when the server has covered the entire order from wallet credit
  // (amountDueToGateway === 0 AND wallet.amountUsed > 0), the client must
  // skip the /api/payments/initialize hop and go straight to the success
  // screen. Any other shape must NOT be misinterpreted as wallet-paid.

  it('returns true when amountDueToGateway is 0 and wallet was used', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 0,
        wallet: { amountUsed: 1000, newBalance: 0, transactionId: 'tx-1' },
      })
    ).toBe(true);
  });

  it('returns false when wallet was used but residual is still owed to gateway', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 200,
        wallet: { amountUsed: 800, newBalance: 0, transactionId: 'tx-1' },
      })
    ).toBe(false);
  });

  it('returns false when amountDueToGateway is 0 but no wallet was applied (free orders / 100% discount)', () => {
    // Orders with no wallet redemption that resolve to 0 (e.g. fully
    // discounted) must NOT take the wallet-only success path because the
    // server-side finalize_wallet_order_payment was never called.
    expect(
      isWalletFullyPaidOrder({ amountDueToGateway: 0, wallet: null })
    ).toBe(false);
  });

  it('returns false when the wallet response object is missing entirely', () => {
    expect(
      isWalletFullyPaidOrder({ amountDueToGateway: 1000, wallet: null })
    ).toBe(false);
  });

  it('returns false when amountDueToGateway is positive even with a wallet block', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 500,
        wallet: { amountUsed: 500, newBalance: 0, transactionId: 'tx-1' },
      })
    ).toBe(false);
  });
});

describe('buildWalletOrderFields', () => {
  // Pin the createOrder payload contract: the fields are only emitted when
  // the wallet selection is fully formed (use=true AND amount>0). The
  // service-layer guard in orders.ts:183 enforces the same rule, so this
  // helper just expresses the intent at the call site.

  it('returns an empty object when no wallet selection is active', () => {
    expect(buildWalletOrderFields(undefined)).toEqual({});
    expect(
      buildWalletOrderFields({ use: false, amount: 0 })
    ).toEqual({});
  });

  it('returns an empty object when the wallet amount is non-positive', () => {
    const cases: WalletSelection[] = [
      { use: true, amount: 0 },
      { use: true, amount: -100 },
    ];
    for (const selection of cases) {
      expect(buildWalletOrderFields(selection)).toEqual({});
    }
  });

  it('returns the use_wallet_credit + wallet_amount fields when the selection is fully formed', () => {
    expect(buildWalletOrderFields({ use: true, amount: 800 })).toEqual({
      use_wallet_credit: true,
      wallet_amount: 800,
    });
  });
});
