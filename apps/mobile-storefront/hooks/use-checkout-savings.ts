import { useEffect, useState } from 'react';
import { getEligibleCheckoutSavingsGoal } from '@/lib/checkout-savings';
import { listSavingsGoals, type SavingsGoal } from '@/lib/customer-savings';
import type { SavingsSelection } from '@/lib/wallet-payment-helpers';
import { trackError } from '@/services/analytics';

type CheckoutSavingsCartItem = {
  product_id?: string | null;
  variant_id?: string | null;
};

type UseCheckoutSavingsInput = {
  customerId?: string | null;
  isAuthenticated: boolean;
  items: CheckoutSavingsCartItem[];
  merchantId: string;
  merchantSlug: string;
};

type LiveSavingsSelectionInput = {
  isStoreCreditCompatible: boolean;
  items: CheckoutSavingsCartItem[];
  orderTotal: number;
};

export function useCheckoutSavings({
  customerId,
  isAuthenticated,
  items,
  merchantId,
  merchantSlug,
}: UseCheckoutSavingsInput) {
  const [savingsSelection, setSavingsSelection] = useState<
    SavingsSelection | undefined
  >(undefined);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [isLoadingCheckoutSavings, setIsLoadingCheckoutSavings] =
    useState(false);
  const [checkoutSavingsError, setCheckoutSavingsError] = useState<
    string | null
  >(null);
  const [checkoutSavingsReloadKey, setCheckoutSavingsReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !customerId) {
      setSavingsGoals([]);
      setSavingsSelection(undefined);
      setCheckoutSavingsError(null);
      setIsLoadingCheckoutSavings(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingCheckoutSavings(true);

    const loadSavingsGoals = async () => {
      try {
        const result = await listSavingsGoals({
          merchantId,
          merchantSlug,
        });
        if (!isCancelled) {
          setSavingsGoals(result.goals);
          setCheckoutSavingsError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setSavingsGoals([]);
          setSavingsSelection(undefined);
          setCheckoutSavingsError(
            error instanceof Error
              ? error.message
              : 'Failed to load checkout savings goals'
          );
          trackError(
            'checkout_savings_goals_fetch',
            error instanceof Error
              ? error.message
              : 'Failed to load checkout savings goals',
            { retry_attempt: checkoutSavingsReloadKey }
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCheckoutSavings(false);
        }
      }
    };

    void loadSavingsGoals();

    return () => {
      isCancelled = true;
    };
  }, [
    checkoutSavingsReloadKey,
    customerId,
    isAuthenticated,
    merchantId,
    merchantSlug,
  ]);

  const checkoutSavingsGoal = getEligibleCheckoutSavingsGoal(
    savingsGoals,
    items
  );
  const checkoutSavingsBalance = checkoutSavingsGoal?.currentAmount ?? 0;

  useEffect(() => {
    const selectedGoalHasNoSpendableBalance =
      (checkoutSavingsGoal?.currentAmount ?? 0) <= 0;

    if (
      savingsSelection?.use === true &&
      (savingsSelection.goalId !== checkoutSavingsGoal?.id ||
        selectedGoalHasNoSpendableBalance)
    ) {
      setSavingsSelection(undefined);
    }
  }, [
    checkoutSavingsGoal?.currentAmount,
    checkoutSavingsGoal?.id,
    savingsSelection?.goalId,
    savingsSelection?.use,
  ]);

  // Callers normally pass the current `items` reference. Submit-time guards may
  // pass a cart snapshot, so re-run eligibility only when the snapshot differs.
  const getLiveSavingsSelection = ({
    isStoreCreditCompatible,
    items: snapshotItems,
    orderTotal,
  }: LiveSavingsSelectionInput): SavingsSelection | undefined => {
    const eligibleSavingsGoal =
      snapshotItems === items
        ? checkoutSavingsGoal
        : getEligibleCheckoutSavingsGoal(savingsGoals, snapshotItems);

    if (
      savingsSelection?.use !== true ||
      !isStoreCreditCompatible ||
      !eligibleSavingsGoal ||
      !(eligibleSavingsGoal.currentAmount > 0) ||
      savingsSelection.goalId !== eligibleSavingsGoal.id
    ) {
      return undefined;
    }

    return {
      use: true,
      goalId: eligibleSavingsGoal.id,
      amount: Math.max(
        0,
        Math.min(eligibleSavingsGoal.currentAmount, orderTotal)
      ),
    };
  };

  return {
    checkoutSavingsBalance,
    checkoutSavingsError,
    checkoutSavingsGoal,
    getLiveSavingsSelection,
    isLoadingCheckoutSavings,
    reloadCheckoutSavings: () =>
      setCheckoutSavingsReloadKey((value) => value + 1),
    savingsGoals,
    savingsSelection,
    setSavingsSelection,
  };
}
