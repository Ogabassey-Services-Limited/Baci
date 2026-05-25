import {
  buildSavingsOrderFields,
  buildWalletOrderFields,
  getFullyPaidStoreCreditPaymentMethod,
  isWalletFullyPaidOrder,
  type SavingsSelection,
  type WalletSelection,
} from './wallet-payment-helpers';

const paidOrder = { payment_status: 'paid' as const };

describe('isWalletFullyPaidOrder', () => {
  // Pin the rule that drives the full-wallet bypass branch in checkout.tsx:
  // when the server has covered the entire order from wallet credit
  // (amountDueToGateway === 0 AND wallet.amountUsed > 0), the client must
  // skip the /api/payments/initialize hop and go straight to the success
  // screen. Any other shape must NOT be misinterpreted as wallet-paid.

  const unpaidOrder = { payment_status: 'unpaid' as const };

  it('returns true when order is server-stamped paid AND wallet covers fully', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 0,
        wallet: { amountUsed: 1000, newBalance: 0, transactionId: 'tx-1' },
        order: paidOrder,
      })
    ).toBe(true);
  });

  it('returns false when wallet was used but residual is still owed to gateway', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 200,
        wallet: { amountUsed: 800, newBalance: 0, transactionId: 'tx-1' },
        order: paidOrder,
      })
    ).toBe(false);
  });

  it('returns false when amountDueToGateway is 0 but no wallet was applied (free orders / 100% discount)', () => {
    // Orders with no wallet redemption that resolve to 0 (e.g. fully
    // discounted) must NOT take the wallet-only success path because the
    // server-side finalize_wallet_order_payment was never called.
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 0,
        wallet: null,
        order: paidOrder,
      })
    ).toBe(false);
  });

  it('returns false when the wallet response object is missing entirely', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 1000,
        wallet: null,
        order: paidOrder,
      })
    ).toBe(false);
  });

  it('returns false when wallet is undefined (older response shapes / partial payloads)', () => {
    // Regression: a previous draft did `wallet !== null && wallet.amountUsed`,
    // which would throw on `wallet === undefined` because
    // `undefined !== null` is true and accessing .amountUsed on undefined
    // crashes. Optional chaining keeps it safe.
    expect(
      isWalletFullyPaidOrder({ amountDueToGateway: 0, order: paidOrder })
    ).toBe(false);
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 0,
        wallet: undefined,
        order: paidOrder,
      })
    ).toBe(false);
  });

  it('returns false when amountDueToGateway is positive even with a wallet block', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 500,
        wallet: { amountUsed: 500, newBalance: 0, transactionId: 'tx-1' },
        order: paidOrder,
      })
    ).toBe(false);
  });

  it('returns false when wallet covers fully but server did NOT stamp the order paid (finalize_wallet_order_payment failed)', () => {
    // Regression: /api/orders/route.ts logs the finalize RPC error and
    // returns the order as-is (payment_status still 'unpaid') with
    // amountDueToGateway === 0 and wallet.amountUsed populated. Without
    // the payment_status check, the client would clear the cart and
    // route to success on an unpaid order.
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 0,
        wallet: { amountUsed: 1000, newBalance: 0, transactionId: 'tx-1' },
        order: unpaidOrder,
      })
    ).toBe(false);
  });

  it('returns false when the order field is missing entirely', () => {
    expect(
      isWalletFullyPaidOrder({
        amountDueToGateway: 0,
        wallet: { amountUsed: 1000, newBalance: 0, transactionId: 'tx-1' },
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
    expect(buildWalletOrderFields({ use: false, amount: 0 })).toEqual({});
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

describe('buildSavingsOrderFields', () => {
  it('returns an empty object when no savings selection is active', () => {
    expect(buildSavingsOrderFields(undefined)).toEqual({});
    expect(
      buildSavingsOrderFields({ use: false, goalId: null, amount: 0 })
    ).toEqual({});
  });

  it('returns an empty object when the savings selection is incomplete', () => {
    const cases: SavingsSelection[] = [
      { use: true, goalId: null, amount: 800 },
      { use: true, goalId: '', amount: 800 },
      { use: true, goalId: 'goal-1', amount: 0 },
      { use: true, goalId: 'goal-1', amount: -100 },
    ];

    for (const selection of cases) {
      expect(buildSavingsOrderFields(selection)).toEqual({});
    }
  });

  it('returns the savings credit fields when the selection is fully formed', () => {
    expect(
      buildSavingsOrderFields({
        use: true,
        goalId: ' 123e4567-e89b-12d3-a456-426614174555 ',
        amount: 5000,
      })
    ).toEqual({
      use_savings_credit: true,
      savings_goal_id: '123e4567-e89b-12d3-a456-426614174555',
      savings_amount: 5000,
    });
  });
});

describe('getFullyPaidStoreCreditPaymentMethod', () => {
  it('returns savings when savings alone fully settles a paid order', () => {
    expect(
      getFullyPaidStoreCreditPaymentMethod({
        amountDueToGateway: 0,
        order: paidOrder,
        savings: {
          amountUsed: 470000,
          goalId: 'goal-1',
          redemptionId: 'redemption-1',
        },
        wallet: null,
      })
    ).toBe('savings');
  });

  it('returns store_credit when wallet and savings together settle a paid order', () => {
    expect(
      getFullyPaidStoreCreditPaymentMethod({
        amountDueToGateway: 0,
        order: paidOrder,
        savings: {
          amountUsed: 200000,
          goalId: 'goal-1',
          redemptionId: 'redemption-1',
        },
        wallet: {
          amountUsed: 270000,
          newBalance: 0,
          transactionId: 'wallet-tx-1',
        },
      })
    ).toBe('store_credit');
  });

  it('returns wallet when wallet alone fully settles a paid order', () => {
    expect(
      getFullyPaidStoreCreditPaymentMethod({
        amountDueToGateway: 0,
        order: paidOrder,
        savings: null,
        wallet: {
          amountUsed: 270000,
          newBalance: 0,
          transactionId: 'wallet-tx-1',
        },
      })
    ).toBe('wallet');
  });

  it('returns undefined when savings was used but a gateway residual remains', () => {
    expect(
      getFullyPaidStoreCreditPaymentMethod({
        amountDueToGateway: 1000,
        order: paidOrder,
        savings: {
          amountUsed: 469000,
          goalId: 'goal-1',
          redemptionId: 'redemption-1',
        },
        wallet: null,
      })
    ).toBeUndefined();
  });

  it('returns undefined when savings was applied but the order is unpaid', () => {
    expect(
      getFullyPaidStoreCreditPaymentMethod({
        amountDueToGateway: 0,
        order: { payment_status: 'unpaid' },
        savings: {
          amountUsed: 469000,
          goalId: 'goal-1',
          redemptionId: 'redemption-1',
        },
        wallet: null,
      })
    ).toBeUndefined();
  });

  it('returns undefined when no store credit was used', () => {
    expect(
      getFullyPaidStoreCreditPaymentMethod({
        amountDueToGateway: 0,
        order: paidOrder,
        savings: null,
        wallet: null,
      })
    ).toBeUndefined();
  });
});
