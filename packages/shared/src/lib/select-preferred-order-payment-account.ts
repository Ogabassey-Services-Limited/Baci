export interface OrderPaymentAccountLike {
  account_name: string | null;
  account_number: string;
  assigned_at?: string | null;
  bank_name: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  provider?: string | null;
}

const PAYSTACK_DVA_WINDOW_MS = 90 * 60 * 1000;
const PAYSTACK_DVA_CLOCK_SKEW_MS = 5 * 60 * 1000;

function isActivePaystackAccount(
  account: OrderPaymentAccountLike,
  nowMs: number
) {
  if (account.provider !== 'paystack') return true;

  const expiresAt = account.expires_at
    ? Date.parse(account.expires_at)
    : Number.NaN;
  if (Number.isFinite(expiresAt) && nowMs >= expiresAt) return false;

  const assignedAt = account.assigned_at
    ? Date.parse(account.assigned_at)
    : account.created_at
      ? Date.parse(account.created_at)
      : Number.NaN;
  return (
    !Number.isFinite(assignedAt) ||
    (nowMs >= assignedAt - PAYSTACK_DVA_CLOCK_SKEW_MS &&
      nowMs <= assignedAt + PAYSTACK_DVA_WINDOW_MS)
  );
}

/**
 * Select one account deterministically when an order has legacy and current
 * provider rows. Paystack is preferred because it is the only provider whose
 * DVA rows are matched by the Paystack webhook; otherwise the newest row wins.
 */
export function selectPreferredOrderPaymentAccount<
  T extends OrderPaymentAccountLike,
>(accounts: readonly T[] | null | undefined, now = new Date()): T | null {
  if (!accounts || accounts.length === 0) {
    return null;
  }

  return (
    accounts
      .filter((account) => isActivePaystackAccount(account, now.getTime()))
      .sort((left, right) => {
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
      })[0] ?? null
  );
}
