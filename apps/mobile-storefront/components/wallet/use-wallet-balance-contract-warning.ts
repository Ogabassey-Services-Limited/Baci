import { useEffect } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('Wallet');
const warnedWalletBalanceWarnings = new Set<string>();

type WalletBalanceField =
  | 'earnings_balance'
  | 'savings_balance'
  | 'total_balance';
type WalletBalanceWarningKey = WalletBalanceField | 'total_balance_mismatch';

type WalletBalanceData = {
  balance?: number;
  earnings_balance?: number;
  savings_balance?: number;
  total_balance?: number;
};

interface UseWalletBalanceContractWarningParams {
  merchantId?: string | null;
  ownerId?: string | null;
  walletData?: WalletBalanceData | null;
}

function logWalletBalanceContractWarning({
  computedTotalBalance,
  earningsBalance,
  merchantId,
  ownerId,
  savingsBalance,
  totalBalance,
  walletData,
}: {
  computedTotalBalance: number;
  earningsBalance: number;
  merchantId: string;
  ownerId: string;
  savingsBalance: number;
  totalBalance: number;
  walletData: WalletBalanceData;
}) {
  const fallbackValues: Record<WalletBalanceField, number> = {
    earnings_balance: earningsBalance,
    savings_balance: savingsBalance,
    total_balance: totalBalance,
  };
  const missingFields = (
    ['earnings_balance', 'savings_balance', 'total_balance'] as const
  ).filter((field) => walletData[field] == null);
  const hasTotalMismatch =
    walletData.total_balance != null &&
    walletData.total_balance !== computedTotalBalance;
  const warningScope = `${merchantId || 'unknown-merchant'}:${ownerId || 'unknown-owner'}`;
  const getDedupeKey = (warningKey: WalletBalanceWarningKey) =>
    `${warningScope}:${warningKey}`;
  const newMissingFields = missingFields.filter(
    (field) => !warnedWalletBalanceWarnings.has(getDedupeKey(field))
  );
  const shouldWarnTotalMismatch =
    hasTotalMismatch &&
    !warnedWalletBalanceWarnings.has(getDedupeKey('total_balance_mismatch'));

  if (newMissingFields.length === 0 && !shouldWarnTotalMismatch) {
    return;
  }

  for (const field of newMissingFields) {
    warnedWalletBalanceWarnings.add(getDedupeKey(field));
  }
  if (shouldWarnTotalMismatch) {
    warnedWalletBalanceWarnings.add(getDedupeKey('total_balance_mismatch'));
  }

  log.warn('Wallet API balance contract warning; using safe display values.', {
    computedTotalBalance,
    fallbackValues: Object.fromEntries(
      newMissingFields.map((field) => [field, fallbackValues[field]])
    ),
    mismatchedFields: shouldWarnTotalMismatch ? ['total_balance'] : [],
    missingFields: newMissingFields,
    merchantId,
    ownerId,
    serverTotalBalance: walletData.total_balance,
  });
}

export function useWalletBalanceContractWarning({
  merchantId,
  ownerId,
  walletData,
}: UseWalletBalanceContractWarningParams) {
  useEffect(() => {
    if (!walletData || !ownerId || !merchantId) {
      return;
    }

    const earningsBalance =
      walletData.earnings_balance ?? walletData.balance ?? 0;
    const savingsBalance = walletData.savings_balance ?? 0;
    const computedTotalBalance = earningsBalance + savingsBalance;
    const totalBalance = walletData.total_balance ?? computedTotalBalance;

    logWalletBalanceContractWarning({
      computedTotalBalance,
      earningsBalance,
      merchantId,
      ownerId,
      savingsBalance,
      totalBalance,
      walletData,
    });
  }, [merchantId, ownerId, walletData]);
}
