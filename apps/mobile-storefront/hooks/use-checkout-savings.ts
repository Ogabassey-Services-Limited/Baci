import { useEffect, useState } from 'react';
import { getEligibleCheckoutSavingsGoal } from '@/lib/checkout-savings';
import { listSavingsGoals, type SavingsGoal } from '@/lib/customer-savings';
import { classifyFetchFailure } from '@/lib/fetch-failure-classification';
import type { SavingsSelection } from '@/lib/wallet-payment-helpers';
import { trackFetchFailure } from '@/services/track-fetch-failure';

// Bounded automatic retry for transient failures (DNS blips, dropped
// connections) so a momentary network hiccup at checkout never surfaces as
// an error. Non-transient failures fail immediately to the manual retry UI.
const SAVINGS_FETCH_MAX_RETRIES = 2;
const SAVINGS_FETCH_RETRY_BASE_DELAY_MS = 1_500;

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

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
    const abortController = new AbortController();

    const load = async () => {
      for (let attempt = 0; attempt <= SAVINGS_FETCH_MAX_RETRIES; attempt++) {
        try {
          const result = await listSavingsGoals({
            merchantId,
            merchantSlug,
            signal: abortController.signal,
          });
          if (isCancelled) {
            return;
          }
          setSavingsGoals(result.goals);
          setCheckoutSavingsError(null);
          return;
        } catch (error: unknown) {
          if (isCancelled || abortController.signal.aborted) {
            return;
          }
          // callerAborted: false — the guard above returned for our own
          // aborts, so an abort-like failure here is a transport
          // interruption on a live screen and should retry, not vanish.
          const classified = classifyFetchFailure(error, {
            callerAborted: false,
          });
          if (classified.isRetryable && attempt < SAVINGS_FETCH_MAX_RETRIES) {
            await abortableDelay(
              SAVINGS_FETCH_RETRY_BASE_DELAY_MS * 2 ** attempt,
              abortController.signal
            );
            if (isCancelled || abortController.signal.aborted) {
              return;
            }
            continue;
          }
          trackFetchFailure(
            'checkout_savings_goals_fetch',
            error,
            {
              merchant_slug: merchantSlug,
              reload_attempt: checkoutSavingsReloadKey,
              retry_count: attempt,
            },
            { callerAborted: false }
          );
          setSavingsGoals([]);
          setSavingsSelection(undefined);
          setCheckoutSavingsError(classified.message);
          return;
        }
      }
    };

    load().finally(() => {
      if (!isCancelled) {
        setIsLoadingCheckoutSavings(false);
      }
    });

    return () => {
      isCancelled = true;
      abortController.abort();
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
