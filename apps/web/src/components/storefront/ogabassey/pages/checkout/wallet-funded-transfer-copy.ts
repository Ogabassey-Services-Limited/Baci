import type { WalletOrderFundingIntentStatus } from '@/schemas/order-wallet-funding-intent';

export type WalletFundedTransferTone =
  | 'waiting'
  | 'progress'
  | 'success'
  | 'review'
  | 'stopped';

export interface WalletFundedTransferPresentation {
  body: string;
  /**
   * TRUE for `completed` ONLY. Every other state — including `review_required`
   * — must never be rendered as a paid order.
   */
  claimsPaid: boolean;
  /** Keep the account number on screen so the customer can top up / retry. */
  showAccount: boolean;
  /** Non-terminal: keep polling and keep the spinner. */
  keepPolling: boolean;
  title: string;
  tone: WalletFundedTransferTone;
}

/**
 * The intent's real server-side deadline (`expiresAt`, 30 min TTL). The legacy
 * DVA modal hardcodes "expires in 60:00" while the row lives 90 min — never
 * invent a number here, always render what the server returned.
 */
export function formatWalletTransferDeadline(expiresAt: string): string | null {
  const deadline = new Date(expiresAt);
  if (Number.isNaN(deadline.getTime())) {
    return null;
  }
  return deadline.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Honest copy for all 9 intent states. `review_required` is the dangerous one:
 * the transfer matched several open intents and a human is reconciling it, so
 * the money is in the wallet but the ORDER IS NOT PAID — we say exactly that.
 */
export function describeWalletFundedTransfer({
  formatCurrency,
  fundedAmount,
  remainingAmount,
  status,
}: {
  formatCurrency: (amount: number) => string;
  fundedAmount: number;
  remainingAmount: number;
  status: WalletOrderFundingIntentStatus;
}): WalletFundedTransferPresentation {
  switch (status) {
    case 'underfunded':
      return {
        body: `We received ${formatCurrency(fundedAmount)}. Send the remaining ${formatCurrency(remainingAmount)} to the same account and this order pays itself automatically. Nothing is lost — the part you sent is already in your wallet.`,
        claimsPaid: false,
        keepPolling: true,
        showAccount: true,
        title: 'Part of your transfer landed',
        tone: 'progress',
      };
    case 'funded':
    case 'processing':
      return {
        body: 'Your transfer landed. We are crediting your wallet and paying this order — this only takes a moment.',
        claimsPaid: false,
        keepPolling: true,
        showAccount: false,
        title: 'Transfer received',
        tone: 'progress',
      };
    case 'completed':
      return {
        body: 'Your wallet was credited and this order has been paid in full.',
        claimsPaid: true,
        keepPolling: false,
        showAccount: false,
        title: 'Order paid',
        tone: 'success',
      };
    case 'review_required':
      return {
        body: 'Your money is safe in your wallet, but we could not tell which order this transfer was for, so our team is checking it. This order is NOT paid yet — please do not send it again. We will update you shortly.',
        claimsPaid: false,
        keepPolling: false,
        showAccount: false,
        title: 'We are checking your transfer',
        tone: 'review',
      };
    case 'expired':
      return {
        body: 'This transfer window has closed. Anything you sent is still in your wallet — start checkout again and it will be applied.',
        claimsPaid: false,
        keepPolling: false,
        showAccount: false,
        title: 'Transfer window expired',
        tone: 'stopped',
      };
    case 'cancelled':
      return {
        body: 'This transfer was cancelled. Anything you sent is still in your wallet and can be used on your next order.',
        claimsPaid: false,
        keepPolling: false,
        showAccount: false,
        title: 'Transfer cancelled',
        tone: 'stopped',
      };
    case 'failed':
      return {
        body: 'We could not complete this payment. Anything you sent is still in your wallet — contact support and we will sort it out.',
        claimsPaid: false,
        keepPolling: false,
        showAccount: false,
        title: 'Payment could not be completed',
        tone: 'stopped',
      };
    default:
      return {
        body: 'Send the exact amount below to your account number. The moment it lands, your wallet is credited and this order pays itself — you do not have to do anything else.',
        claimsPaid: false,
        keepPolling: true,
        showAccount: true,
        title: 'Waiting for your transfer',
        tone: 'waiting',
      };
  }
}
