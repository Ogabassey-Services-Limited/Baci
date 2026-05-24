import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { inferProviderFromDataBillerName } from './data-form.helpers';
import { findDataPlanByCode } from './data-plan-selection';

interface UseDataBillerInitializationInput {
  dataPlans: Biller[] | undefined;
  initialPlan: string | undefined;
  initialProvider: string | undefined;
  setIsDataPickerExpanded: Dispatch<SetStateAction<boolean>>;
  setSelectedDataBiller: Dispatch<SetStateAction<Biller | null>>;
  setPlanAmount: Dispatch<SetStateAction<number>>;
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
  setPlanAmount,
  setSelectedPlan,
  setSelectedProvider,
}: UseDataBillerInitializationInput) {
  const selectedDataBillerRef = useRef<Biller | null>(null);

  useEffect(() => {
    if (selectedDataBillerRef.current || !initialPlan || !dataPlans?.length) {
      return;
    }

    let matchedNestedBillItem: BillItem | null = null;
    let matchedNestedPlan: Biller | null = null;
    for (const plan of dataPlans) {
      const billItem = findDataPlanByCode(plan.billItems, initialPlan);
      if (billItem) {
        matchedNestedBillItem = billItem;
        matchedNestedPlan = plan;
        break;
      }
    }
    const matchedPlan =
      matchedNestedPlan ??
      dataPlans.find((plan) => plan.billerId === initialPlan) ??
      null;
    if (!matchedPlan) {
      return;
    }

    selectedDataBillerRef.current = matchedPlan;
    setSelectedDataBiller(matchedPlan);
    setSelectedPlan(
      matchedNestedBillItem
        ? matchedNestedBillItem.itemCode
        : matchedPlan.billerId
    );
    if (
      matchedNestedBillItem?.isAmountFixed &&
      matchedNestedBillItem.amount > 0
    ) {
      setPlanAmount(matchedNestedBillItem.amount);
    }
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
    setPlanAmount,
    setSelectedPlan,
    setSelectedProvider,
  ]);

  return selectedDataBillerRef;
}
