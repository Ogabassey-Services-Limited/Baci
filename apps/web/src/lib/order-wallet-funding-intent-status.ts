import type { WalletOrderFundingIntentStatus } from '@/schemas/order-wallet-funding-intent';

const TERMINAL_STATUSES: readonly WalletOrderFundingIntentStatus[] = [
  'cancelled',
  'completed',
  'expired',
  'failed',
  'review_required',
];

/**
 * Terminal = stop polling. Note `review_required` is terminal for the CLIENT
 * (a human reconciles it) but is NOT a success — see
 * `describeWalletFundedTransfer`. `underfunded` is deliberately NOT terminal:
 * a partial transfer keeps the account on screen and keeps polling, because a
 * follow-up transfer still completes the order.
 */
export function isTerminalWalletFundingIntentStatus(
  status: WalletOrderFundingIntentStatus
): boolean {
  return TERMINAL_STATUSES.includes(status);
}
