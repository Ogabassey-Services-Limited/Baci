import { Alert } from 'react-native';
import type { WalletActiveSavingsGoal } from '@/hooks/wallet-query';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';

interface AddSavingsContributionParams {
  activeMerchantId?: string;
  activeMerchantSlug?: string;
  addSavingsContribution: (input: {
    amount: number;
    goalId: string;
    idempotencyKey: string;
    merchantId?: string;
    merchantSlug?: string;
  }) => Promise<unknown>;
  clearSavingsContributionAmount: () => void;
  createIdempotencyKey: () => string;
  goal: WalletActiveSavingsGoal | null;
  rawAmount: string;
  refetchWallet: () => Promise<unknown>;
  setIsAddingSavingsContribution: (isPending: boolean) => void;
}

export async function addSavingsContributionToGoal({
  activeMerchantId,
  activeMerchantSlug,
  addSavingsContribution,
  clearSavingsContributionAmount,
  createIdempotencyKey,
  goal,
  rawAmount,
  refetchWallet,
  setIsAddingSavingsContribution,
}: AddSavingsContributionParams): Promise<void> {
  if (!goal) {
    Alert.alert('No active savings goal', 'Start a savings goal first.');
    return;
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    Alert.alert('Invalid amount', 'Enter the amount you want to save.');
    return;
  }

  const remainingAmount = Math.max(0, goal.target_amount - goal.current_amount);
  if (amount > remainingAmount) {
    Alert.alert(
      'Amount too high',
      `You only have ${formatNgnCurrency(remainingAmount)} left on this goal.`
    );
    return;
  }

  setIsAddingSavingsContribution(true);
  try {
    await addSavingsContribution({
      amount,
      goalId: goal.id,
      idempotencyKey: createIdempotencyKey(),
      merchantId: activeMerchantId,
      merchantSlug: activeMerchantSlug,
    });
    clearSavingsContributionAmount();
    await refetchWallet();
    Alert.alert(
      'Savings updated',
      `Added ${formatNgnCurrency(amount)} to your savings goal.`
    );
  } catch (error) {
    Alert.alert(
      'Unable to add savings',
      error instanceof Error ? error.message : 'Please try again in a moment.'
    );
  } finally {
    setIsAddingSavingsContribution(false);
  }
}
