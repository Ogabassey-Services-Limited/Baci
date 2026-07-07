import type { WalletActiveSavingsGoal } from '@/hooks/wallet-query';
import type { WalletDisplayFundingAccount } from './wallet.types';

interface WalletFundingAccountLike {
  account_name?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  provider?: string | null;
}

interface WalletDataLike {
  active_savings_goal?: WalletActiveSavingsGoal | null;
  balance?: number | null;
  earnings_balance?: number | null;
  funding_account?: WalletFundingAccountLike | null;
  savings_balance?: number | null;
  total_balance?: number | null;
}

export function normalizeRequiredFundingAccountValue(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function deriveWalletDisplayData(walletData: WalletDataLike) {
  const earningsBalance =
    walletData.earnings_balance ?? walletData.balance ?? 0;
  const savingsBalance = walletData.savings_balance ?? 0;
  const totalBalance =
    walletData.total_balance ?? earningsBalance + savingsBalance;
  const rawFundingAccount = walletData.funding_account;
  const accountName = normalizeRequiredFundingAccountValue(
    rawFundingAccount?.account_name
  );
  const accountNumber = normalizeRequiredFundingAccountValue(
    rawFundingAccount?.account_number
  );
  const bankName = normalizeRequiredFundingAccountValue(
    rawFundingAccount?.bank_name
  );
  const provider = normalizeRequiredFundingAccountValue(
    rawFundingAccount?.provider
  );
  const fundingAccount: WalletDisplayFundingAccount | null =
    accountName && accountNumber && bankName && provider
      ? { accountName, accountNumber, bankName, provider }
      : null;

  return {
    earningsBalance,
    activeSavingsGoal: walletData.active_savings_goal ?? null,
    fundingAccount,
    savingsBalance,
    showQuickSave: Boolean(walletData.active_savings_goal),
    totalBalance,
  };
}
