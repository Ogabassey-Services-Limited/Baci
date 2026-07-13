import type { WalletCreditWatchStatus } from '@/hooks/use-wallet-credit-watch';
import { formatPrice } from '@/stores/cart-store';

interface WalletCreditStatusCopy {
  icon:
    | 'sync-outline'
    | 'checkmark-circle-outline'
    | 'refresh-circle-outline';
  message: string;
  title: string;
}

function formatCreditValue(amount?: number | null) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return formatPrice(amount);
}

/**
 * Maps the credit-watch status to acknowledgement copy, mirroring
 * `getWalletFundingStatusCopy`. The `timedOut` copy deliberately never claims
 * the wallet was credited — it invites the customer to check again.
 */
export function getWalletCreditStatusCopy({
  creditedAmount,
  status,
}: {
  creditedAmount?: number | null;
  status: WalletCreditWatchStatus;
}): WalletCreditStatusCopy | null {
  if (status === 'checking') {
    return {
      icon: 'sync-outline',
      message:
        "Hang tight — we'll confirm the moment your transfer reaches your wallet.",
      title: 'Checking for your transfer…',
    };
  }

  if (status === 'credited') {
    const formattedAmount = formatCreditValue(creditedAmount);
    return {
      icon: 'checkmark-circle-outline',
      message: formattedAmount
        ? `${formattedAmount} landed in your wallet.`
        : 'Your transfer landed in your wallet.',
      title: 'Wallet credited',
    };
  }

  if (status === 'timedOut') {
    return {
      icon: 'refresh-circle-outline',
      message:
        "We couldn't confirm your transfer yet — it can take a few minutes. Tap check again, or contact support.",
      title: 'Still checking…',
    };
  }

  return null;
}
