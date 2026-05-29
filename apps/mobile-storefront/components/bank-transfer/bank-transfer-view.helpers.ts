import type { z } from 'zod';
import type { walletOrderFundingIntentStatusSchema } from '@/schemas/order-wallet-funding-intent';
import { formatPrice } from '@/stores/cart-store';

export type WalletFundingStatus = z.infer<
  typeof walletOrderFundingIntentStatusSchema
>;

export function formatTransferAmount(amount?: string) {
  if (!amount) return null;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return null;
  return formatPrice(numericAmount);
}

function formatTransferValue(amount?: number) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return formatPrice(amount);
}

export function getWalletFundingStatusCopy({
  orderNumber,
  remainingAmount,
  status,
}: {
  orderNumber?: string;
  remainingAmount?: number;
  status?: WalletFundingStatus;
}) {
  if (status === 'underfunded') {
    const formattedAmount = formatTransferValue(remainingAmount);
    if (!formattedAmount) {
      return {
        title: 'Additional payment needed',
        message:
          'Additional payment is needed, but we could not confirm the exact amount. Please add funds or contact support.',
        icon: 'alert-circle-outline' as const,
      };
    }
    return {
      title: 'Transfer remaining amount',
      message: `${formattedAmount} still needed`,
      icon: 'alert-circle-outline' as const,
    };
  }

  if (status === 'review_required') {
    return {
      title: 'Transfer under review',
      message: orderNumber
        ? `Support is reviewing payment for order ${orderNumber}.`
        : 'Support is reviewing payment for this order.',
      icon: 'help-circle-outline' as const,
    };
  }

  if (status === 'failed') {
    return {
      title: 'Payment failed',
      message:
        'Unable to process this payment. Please contact support or try again.',
      icon: 'close-circle-outline' as const,
    };
  }

  if (status === 'expired' || status === 'cancelled') {
    return {
      title: 'Payment window expired',
      message: 'Please restart checkout to generate fresh payment details.',
      icon: 'time-outline' as const,
    };
  }

  if (status === 'completed') {
    return {
      title: 'Payment confirmed',
      message: 'Your wallet funded this order successfully.',
      icon: 'checkmark-circle-outline' as const,
    };
  }

  return null;
}

export function getDisplayStatusCopy({
  orderNumber,
  pollingTimedOut,
  remainingAmount,
  walletFundingStatus,
}: {
  orderNumber?: string;
  pollingTimedOut: boolean;
  remainingAmount?: number;
  walletFundingStatus?: WalletFundingStatus;
}) {
  const statusCopy = getWalletFundingStatusCopy({
    orderNumber,
    remainingAmount,
    status: walletFundingStatus,
  });
  if (statusCopy) {
    return statusCopy;
  }
  if (pollingTimedOut) {
    return {
      icon: 'refresh-circle-outline' as const,
      message: 'Tap check payment status to refresh, or contact support.',
      title: 'Auto-check stopped',
    };
  }
  return null;
}
