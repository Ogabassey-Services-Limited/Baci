import { useEffect, useRef, useState } from 'react';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import {
  getAmountForLeaf,
  getInitialAmountForSelection,
} from './bill-form.helpers';
import { findInitialBillerMatch } from './bill-item-matching';
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
  const hasInitializedRef = useRef(false);

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

  useEffect(() => {
    if (hasInitializedRef.current || !billers?.length) {
      return;
    }
    const match = findInitialBillerMatch({
      billers,
      initialBillerName,
      initialBillItemIdentifier,
    });
    if (!match) {
      return;
    }
    const nextSelection = resolveBillItemSelection(
      match.biller.billItems,
      match.codes
    );
    setSelectedBiller(match.biller);
    hasInitializedRef.current = true;
    if (!match.resolvedToSpecificBillItem || !nextSelection.isComplete) {
      return;
    }

    setSelectedBillItemCodes(match.codes);
    setIsProviderPickerExpanded(false);
    setAmountRef.current(
      getInitialAmountForSelection(nextSelection.leaf, initialAmount)
    );
    if (isRepeatPaymentReady && initialCustomerIdentifier) {
      onInitialRepeatPaymentReadyRef.current();
    }
  }, [
    billers,
    initialAmount,
    initialBillerName,
    initialBillItemIdentifier,
    initialCustomerIdentifier,
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
