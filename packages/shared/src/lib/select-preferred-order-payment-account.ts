export interface OrderPaymentAccountLike {
  account_name: string | null;
  account_number: string;
  bank_name: string | null;
  created_at?: string | null;
  provider?: string | null;
}

/**
 * Select one account deterministically when an order has legacy and current
 * provider rows. Paystack is preferred because it is the only provider whose
 * DVA rows are matched by the Paystack webhook; otherwise the newest row wins.
 */
export function selectPreferredOrderPaymentAccount<
  T extends OrderPaymentAccountLike,
>(accounts: readonly T[] | null | undefined): T | null {
  if (!accounts || accounts.length === 0) {
    return null;
  }

  return [...accounts].sort((left, right) => {
    const leftProviderRank = left.provider === 'paystack' ? 0 : 1;
    const rightProviderRank = right.provider === 'paystack' ? 0 : 1;
    if (leftProviderRank !== rightProviderRank) {
      return leftProviderRank - rightProviderRank;
    }

    const leftCreatedAt = left.created_at
      ? Date.parse(left.created_at)
      : Number.NaN;
    const rightCreatedAt = right.created_at
      ? Date.parse(right.created_at)
      : Number.NaN;
    const leftCreatedAtMs = Number.isFinite(leftCreatedAt)
      ? leftCreatedAt
      : Number.NEGATIVE_INFINITY;
    const rightCreatedAtMs = Number.isFinite(rightCreatedAt)
      ? rightCreatedAt
      : Number.NEGATIVE_INFINITY;
    if (leftCreatedAtMs !== rightCreatedAtMs) {
      return rightCreatedAtMs - leftCreatedAtMs;
    }

    return left.account_number.localeCompare(right.account_number);
  })[0];
}
