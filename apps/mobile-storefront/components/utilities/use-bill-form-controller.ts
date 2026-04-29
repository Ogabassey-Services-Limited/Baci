import { useEffect, useRef, useState } from 'react';
import { Alert, type LayoutChangeEvent, type ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { useVTUVerify } from '@/hooks/use-vtu-verify';
import { useAuthStore } from '@/stores/auth-store';
import {
  BILL_FORM_FOOTER_ERROR_BUFFER,
  BILL_FORM_FOOTER_HEIGHT,
  BILL_TYPE_MAP,
  IDENTIFIER_LABELS,
} from './bill-form.constants';
import {
  getAmountForLeaf,
  getInitialAmountForSelection,
} from './bill-form.helpers';
import type { BillFormProps } from './bill-form.types';
import { findInitialBillerMatch } from './bill-item-matching';
import {
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { formatUtilityAmountInput } from './utility-amount-format';
import { createBillFormPurchaseHandler } from './create-bill-form-purchase-handler';
import { useNextStepScroll } from './use-next-step-scroll';

export function useBillFormController({
  initialAmount,
  initialBillerName,
  initialBillItemIdentifier,
  initialCustomerIdentifier,
  isRepeatPaymentReady = false,
  type,
  onSuccess,
}: BillFormProps) {
  const insets = useSafeAreaInsets();
  const { dismissKeyboard, isKeyboardVisible, keyboardHeight } = useKeyboard();
  const billType = BILL_TYPE_MAP[type];
  const billersQuery = useVTUBillers(billType);
  const verify = useVTUVerify();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [selectedBillItemCodes, setSelectedBillItemCodes] = useState<string[]>(
    []
  );
  const [customerId, setCustomerId] = useState(initialCustomerIdentifier ?? '');
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProviderPickerExpanded, setIsProviderPickerExpanded] =
    useState(true);
  const [isRepeatPaymentActive, setIsRepeatPaymentActive] = useState(false);
  const [shouldScrollToNextStep, setShouldScrollToNextStep] = useState(false);
  const [shouldScrollToPayment, setShouldScrollToPayment] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scheduleNextStepScroll = useNextStepScroll(scrollViewRef, () => {
    setShouldScrollToNextStep(false);
  });
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
  const numericAmount = Number(amount.replace(/\D/g, ''));
  const canShowPayment = Boolean(
    verify.data?.verified || isRepeatPaymentActive
  );

  useEffect(() => {
    if (selectedBiller || !billersQuery.data?.length) {
      return;
    }
    const match = findInitialBillerMatch({
      billers: billersQuery.data,
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
    if (!match.resolvedToSpecificBillItem || !nextSelection.isComplete) {
      return;
    }

    setSelectedBillItemCodes(match.codes);
    setIsProviderPickerExpanded(false);
    setAmount(getInitialAmountForSelection(nextSelection.leaf, initialAmount));
    if (isRepeatPaymentReady && initialCustomerIdentifier) {
      setIsRepeatPaymentActive(true);
      setShouldScrollToPayment(true);
    }
  }, [
    billersQuery.data,
    initialAmount,
    initialBillerName,
    initialBillItemIdentifier,
    initialCustomerIdentifier,
    isRepeatPaymentReady,
    selectedBiller,
  ]);

  const resetVerification = () => {
    if (!verify.isPending) {
      verify.reset();
    }
  };

  const handleBillerSelect = (biller: Biller) => {
    const nextCodes = getResolvedBillItemCodes(biller.billItems);
    const nextSelection = resolveBillItemSelection(biller.billItems, nextCodes);
    setSelectedBiller(biller);
    setSelectedBillItemCodes(nextCodes);
    setIsProviderPickerExpanded(false);
    setShouldScrollToNextStep(true);
    setIsRepeatPaymentActive(false);
    setAmount(getAmountForLeaf(nextSelection.leaf));
    resetVerification();
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
    setIsRepeatPaymentActive(false);
    setAmount(getAmountForLeaf(nextSelection.leaf));
    setShouldScrollToNextStep(true);
    resetVerification();
  };

  const handleVerify = () => {
    dismissKeyboard();
    if (
      !selectedBiller ||
      !selectedBillItemIdentifier ||
      !customerId ||
      !isBillItemSelectionComplete
    ) {
      const steps = ['select a provider'];
      if (requiresBillItemSelection) {
        steps.push('complete the available options');
      }
      steps.push(`enter your ${IDENTIFIER_LABELS[type].toLowerCase()}`);
      Alert.alert('Missing Information', `Please ${steps.join(', ')}.`);
      return;
    }
    verify.mutate({
      billItemIdentifier: selectedBillItemIdentifier,
      customerIdentifier: customerId,
    });
  };

  const handlePurchase = createBillFormPurchaseHandler({
    amount,
    billType: billType as 'electricity' | 'cable_tv' | 'betting',
    canShowPayment,
    customer,
    customerId,
    dismissKeyboard,
    isSubmitting,
    numericAmount,
    onSuccess,
    payment,
    selectedBiller,
    selectedBillItemIdentifier,
    selectedBillItemPathLabel,
    setIsSubmitting,
    type,
  });

  const handlePaymentLayout = (event: LayoutChangeEvent) => {
    if (!shouldScrollToPayment) {
      return;
    }
    const paymentY = event.nativeEvent.layout.y;
    setShouldScrollToPayment(false);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        animated: true,
        y: Math.max(paymentY - SPACING.md, 0),
      });
    });
  };

  return {
    amount,
    billersQuery,
    billItemSelection,
    canShowPayment,
    customerId,
    footerBottomOffset: getUtilityFooterOffset({
      bottomInset: insets.bottom,
      isKeyboardVisible,
      keyboardHeight,
    }),
    footerSpacerHeight: canShowPayment
      ? BILL_FORM_FOOTER_HEIGHT +
        Math.max(insets.bottom, SPACING.md) +
        BILL_FORM_FOOTER_ERROR_BUFFER
      : SPACING.xl,
    formattedAmount: formatUtilityAmountInput(amount),
    handleBillItemSelect,
    handleBillerSelect,
    handlePaymentLayout,
    handlePurchase,
    handleVerify,
    isBillItemSelectionComplete,
    isBusy: isSubmitting,
    isFixedAmount: selectedBillItem?.isAmountFixed ?? false,
    isKeyboardVisible,
    isProviderPickerExpanded,
    isRepeatPaymentActive,
    numericAmount,
    payment,
    resetVerification,
    scheduleNextStepScroll,
    scrollViewRef,
    selectedBiller,
    selectedBillItemIdentifier,
    setAmount,
    setCustomerId,
    setIsProviderPickerExpanded,
    setIsRepeatPaymentActive,
    shouldScrollToNextStep,
    verify,
    insets,
  };
}
