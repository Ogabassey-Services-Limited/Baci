interface PaymentTransactionAmount {
  amount: number | string | null;
  gateway: string | null;
}

export function getOrderPaymentTransactionTotals(
  transactions: PaymentTransactionAmount[] | null | undefined
) {
  return (transactions ?? []).reduce(
    (totals, transaction) => {
      const amount = Number(transaction.amount) || 0;
      const gateway = transaction.gateway?.trim().toLowerCase();
      totals.transactionTotal += amount;
      if (gateway === 'wallet' || gateway === 'store_credit') {
        totals.walletTransactionTotal += amount;
      }
      return totals;
    },
    { transactionTotal: 0, walletTransactionTotal: 0 }
  );
}
