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
  const isSavingsEligible = isAuthenticated && Boolean(customerId);
  const [savingsSelection, setSavingsSelection] = useState<
    SavingsSelection | undefined
  >(undefined);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [isLoadingCheckoutSavings, setIsLoadingCheckoutSavings] =
    useState(isSavingsEligible);
  const [checkoutSavingsError, setCheckoutSavingsError] = useState<
    string | null
  >(null);
  const [checkoutSavingsReloadKey, setCheckoutSavingsReloadKey] = useState(0);

  // Adjust fetch-related state inline during render when the fetch identity
  // changes, instead of routing the reset through an effect
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const savingsFetchKey = isSavingsEligible
    ? `${checkoutSavingsReloadKey}:${merchantId}:${merchantSlug}:${customerId}`
    : null;
  const [prevSavingsFetchKey, setPrevSavingsFetchKey] =
    useState(savingsFetchKey);
  if (savingsFetchKey !== prevSavingsFetchKey) {
    setPrevSavingsFetchKey(savingsFetchKey);
    if (savingsFetchKey === null) {
      setSavingsGoals([]);
      setSavingsSelection(undefined);
      setCheckoutSavingsError(null);
      setIsLoadingCheckoutSavings(false);
    } else {
      setIsLoadingCheckoutSavings(true);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !customerId) {
      return;
    }

    let isCancelled = false;

    listSavingsGoals({
      merchantId,
      merchantSlug,
    })
      .then((result) => {
        if (isCancelled) {
          return;
        }
        setSavingsGoals(result.goals);
        setCheckoutSavingsError(null);
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load checkout savings goals';
        setSavingsGoals([]);
        setSavingsSelection(undefined);
        setCheckoutSavingsError(message);
        trackError('checkout_savings_goals_fetch', message, {
          retry_attempt: checkoutSavingsReloadKey,
        });
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingCheckoutSavings(false);
        }
      });

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

  // Clear a stale selection inline during render so a selection pointing at a
  // missing or empty goal never reaches the committed UI.
  const selectedGoalHasNoSpendableBalance =
    (checkoutSavingsGoal?.currentAmount ?? 0) <= 0;
  if (
    savingsSelection?.use === true &&
    (savingsSelection.goalId !== checkoutSavingsGoal?.id ||
      selectedGoalHasNoSpendableBalance)
  ) {
    setSavingsSelection(undefined);
  }

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
