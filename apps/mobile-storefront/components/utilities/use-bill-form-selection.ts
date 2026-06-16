import { useEffect, useRef, useState } from 'react';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import {
  getAmountForLeaf,
  getInitialAmountForSelection,
} from './bill-form.helpers';
import {
  findInitialBillerMatch,
  type InitialBillerMatch,
} from './bill-item-matching';
import {
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';

interface UseBillFormSelectionInput {
  billers: Biller[] | undefined;
  initialAmount?: string;
  initialBillerName?: string;
  initialBillItemIdentifier?: string;
  initialCustomerIdentifier?: string;
  isRepeatPaymentReady: boolean;
  onInitialRepeatPaymentReady: () => void;
  onSelectionChanged: () => void;
  setAmount: (value: string) => void;
}

export function useBillFormSelection({
  billers,
  initialAmount,
  initialBillerName,
  initialBillItemIdentifier,
  initialCustomerIdentifier,
  isRepeatPaymentReady,
  onInitialRepeatPaymentReady,
  onSelectionChanged,
  setAmount,
}: UseBillFormSelectionInput) {
  const onInitialRepeatPaymentReadyRef = useRef(onInitialRepeatPaymentReady);
  const setAmountRef = useRef(setAmount);
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [selectedBillItemCodes, setSelectedBillItemCodes] = useState<string[]>(
    []
  );
  const [isProviderPickerExpanded, setIsProviderPickerExpanded] =
    useState(true);
  const [initialMatch, setInitialMatch] = useState<InitialBillerMatch | null>(
    null
  );
  const hasAppliedInitialMatchRef = useRef(false);

  // Initialize the selection inline during render once billers arrive so the
  // first committed frame already shows the matched biller
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  if (!initialMatch && billers?.length) {
    const match = findInitialBillerMatch({
      billers,
      initialBillerName,
      initialBillItemIdentifier,
    });
    if (match) {
      const matchedSelection = resolveBillItemSelection(
        match.biller.billItems,
        match.codes
      );
      setInitialMatch(match);
      setSelectedBiller(match.biller);
      if (match.resolvedToSpecificBillItem && matchedSelection.isComplete) {
        setSelectedBillItemCodes(match.codes);
        setIsProviderPickerExpanded(false);
      }
    }
  }

  const billItemSelection = resolveBillItemSelection(
    selectedBiller?.billItems,
    selectedBillItemCodes
  );
  const selectedBillItem = billItemSelection.leaf;
  const selectedBillItemPathLabel = billItemSelection.selectedPath
    .map((item) => item.itemName)
    .join(' / ');
  const requiresBillItemSelection = billItemSelection.levels.length > 0;
  const isBillItemSelectionComplete =
    !requiresBillItemSelection || billItemSelection.isComplete;
  const selectedBillItemIdentifier = requiresBillItemSelection
    ? (selectedBillItem?.itemCode ?? null)
    : (selectedBiller?.billerId ?? null);

  useEffect(() => {
    onInitialRepeatPaymentReadyRef.current = onInitialRepeatPaymentReady;
    setAmountRef.current = setAmount;
  }, [onInitialRepeatPaymentReady, setAmount]);

  // Parent-owned side effects (amount + repeat-payment callback) still run
  // post-commit, exactly once, when the initial match is applied.
  useEffect(() => {
    if (!initialMatch || hasAppliedInitialMatchRef.current) {
      return;
    }
    hasAppliedInitialMatchRef.current = true;
    const matchedSelection = resolveBillItemSelection(
      initialMatch.biller.billItems,
      initialMatch.codes
    );
    if (
      !initialMatch.resolvedToSpecificBillItem ||
      !matchedSelection.isComplete
    ) {
      return;
    }

    setAmountRef.current(
      getInitialAmountForSelection(matchedSelection.leaf, initialAmount)
    );
    if (isRepeatPaymentReady && initialCustomerIdentifier) {
      onInitialRepeatPaymentReadyRef.current();
    }
  }, [
    initialAmount,
    initialCustomerIdentifier,
    initialMatch,
    isRepeatPaymentReady,
  ]);

  const handleBillerSelect = (biller: Biller) => {
    const nextCodes = getResolvedBillItemCodes(biller.billItems);
    const nextSelection = resolveBillItemSelection(biller.billItems, nextCodes);
    setSelectedBiller(biller);
    setSelectedBillItemCodes(nextCodes);
    setIsProviderPickerExpanded(false);
    setAmount(getAmountForLeaf(nextSelection.leaf));
    onSelectionChanged();
  };

  const handleBillItemSelect = (depth: number, billItem: BillItem) => {
    if (!selectedBiller) {
      return;
    }
    const nextCodes = updateBillItemSelection(
      selectedBiller.billItems,
      selectedBillItemCodes,
      depth,
      billItem.itemCode
    );
    const nextSelection = resolveBillItemSelection(
      selectedBiller.billItems,
      nextCodes
    );
    setSelectedBillItemCodes(nextCodes);
    setAmount(getAmountForLeaf(nextSelection.leaf));
    onSelectionChanged();
  };

  return {
    billItemSelection,
    handleBillItemSelect,
    handleBillerSelect,
    isBillItemSelectionComplete,
    isProviderPickerExpanded,
    requiresBillItemSelection,
    selectedBiller,
    selectedBillItem,
    selectedBillItemIdentifier,
    selectedBillItemPathLabel,
    setProviderPickerExpanded: setIsProviderPickerExpanded,
  };
}
