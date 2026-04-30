import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { Biller } from '@/hooks/use-vtu-billers';
import { inferProviderFromDataBillerName } from './data-form.helpers';

interface UseDataBillerInitializationInput {
  dataPlans: Biller[] | undefined;
  initialPlan: string | undefined;
  initialProvider: string | undefined;
  setIsDataPickerExpanded: Dispatch<SetStateAction<boolean>>;
  setSelectedDataBiller: Dispatch<SetStateAction<Biller | null>>;
  setSelectedPlan: Dispatch<SetStateAction<string | null>>;
  setSelectedProvider: Dispatch<SetStateAction<string | null>>;
}

/**
 * On the first render where data plans are available, auto-selects the biller
 * and provider that match `initialPlan` (used for repeat-payment prefill).
 */
export function useDataBillerInitialization({
  dataPlans,
  initialPlan,
  initialProvider,
  setIsDataPickerExpanded,
  setSelectedDataBiller,
  setSelectedPlan,
  setSelectedProvider,
}: UseDataBillerInitializationInput) {
  const selectedDataBillerRef = useRef<Biller | null>(null);

  useEffect(() => {
    if (selectedDataBillerRef.current || !initialPlan || !dataPlans?.length) {
      return;
    }

    const matchedPlan =
      dataPlans.find((plan) => plan.billerId === initialPlan) ?? null;
    if (!matchedPlan) {
      return;
    }

    selectedDataBillerRef.current = matchedPlan;
    setSelectedDataBiller(matchedPlan);
    setSelectedPlan(matchedPlan.billerId);
    setSelectedProvider(
      inferProviderFromDataBillerName(matchedPlan.billerName) ??
        initialProvider ??
        null
    );
    setIsDataPickerExpanded(false);
  }, [
    dataPlans,
    initialPlan,
    initialProvider,
    setIsDataPickerExpanded,
    setSelectedDataBiller,
    setSelectedPlan,
    setSelectedProvider,
  ]);

  return selectedDataBillerRef;
}
