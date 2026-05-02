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
  parseUtilityAmount,
} from './bill-form.helpers';
import type { BillFormProps } from './bill-form.types';
import type { BillFormController } from './bill-form-controller.types';
import { findInitialBillerMatch } from './bill-item-matching';
import {
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';
import { createBillFormPurchaseHandler } from './create-bill-form-purchase-handler';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { useNextStepScroll } from './use-next-step-scroll';
import { formatUtilityAmountInput } from './utility-amount-format';

export type { BillFormController };

export function useBillFormController({
  initialAmount,
  initialBillerName,
  initialBillItemIdentifier,
  initialCustomerIdentifier,
  initialCustomerName,
  isRepeatPaymentReady = false,
  type,
  onSuccess,
}: BillFormProps): BillFormController {
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
  const isSubmittingRef = useRef(false);
  const [isProviderPickerExpanded, setIsProviderPickerExpanded] =
    useState(true);
  const [isRepeatPaymentActive, setIsRepeatPaymentActive] = useState(false);
  const [verifiedCustomerName, setVerifiedCustomerName] = useState<
    string | null
  >(initialCustomerName ?? null);
  const [shouldScrollToNextStep, setShouldScrollToNextStep] = useState(false);
  const [shouldScrollToPayment, setShouldScrollToPayment] = useState(false);
  const pendingVerificationKeyRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  const [verifiedSelectionKey, setVerifiedSelectionKey] = useState<
    string | null
  >(null);
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
  const numericAmount = parseUtilityAmount(amount);
  const normalizedCustomerId = customerId.trim();
  const currentVerificationKey = `${selectedBiller?.billerId ?? ''}:${
    selectedBillItemIdentifier ?? ''
  }:${normalizedCustomerId}`;
  const canShowPayment = Boolean(
    isRepeatPaymentActive || verifiedSelectionKey === currentVerificationKey
  );

  useEffect(() => {
    if (verify.data?.verified && pendingVerificationKeyRef.current) {
      setVerifiedSelectionKey(pendingVerificationKeyRef.current);
      pendingVerificationKeyRef.current = null;
      const verifiedName = verify.data.customerName?.trim();
      if (verifiedName) {
        setVerifiedCustomerName(verifiedName);
      }
    }
  }, [verify.data?.verified, verify.data?.customerName]);

  useEffect(() => {
    if (hasInitializedRef.current || !billersQuery.data?.length) {
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
    hasInitializedRef.current = true;
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
  ]);

  const resetVerification = () => {
    pendingVerificationKeyRef.current = null;
    setVerifiedSelectionKey(null);
    if (!verify.isPending) {
      verify.reset();
    }
  };

  const deactivateRepeatPayment = () => {
    setIsRepeatPaymentActive(false);
    setVerifiedCustomerName(null);
  };

  const handleBillerSelect = (biller: Biller) => {
    const nextCodes = getResolvedBillItemCodes(biller.billItems);
    const nextSelection = resolveBillItemSelection(biller.billItems, nextCodes);
    setSelectedBiller(biller);
    setSelectedBillItemCodes(nextCodes);
    setIsProviderPickerExpanded(false);
    setShouldScrollToNextStep(true);
    deactivateRepeatPayment();
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
    deactivateRepeatPayment();
    setAmount(getAmountForLeaf(nextSelection.leaf));
    setShouldScrollToNextStep(true);
    resetVerification();
  };

  const handleVerify = () => {
    dismissKeyboard();
    if (
      !selectedBiller ||
      !selectedBillItemIdentifier ||
      !normalizedCustomerId ||
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
    pendingVerificationKeyRef.current = currentVerificationKey;
    verify.mutate({
      billItemIdentifier: selectedBillItemIdentifier,
      customerIdentifier: normalizedCustomerId,
    });
  };

  const updateSubmitting = (nextIsSubmitting: boolean) => {
    isSubmittingRef.current = nextIsSubmitting;
    setIsSubmitting(nextIsSubmitting);
  };

  const handlePurchase = createBillFormPurchaseHandler({
    amount,
    billType,
    canShowPayment,
    customer,
    customerId,
    dismissKeyboard,
    getIsSubmitting: () => isSubmittingRef.current,
    numericAmount,
    onSuccess,
    payment,
    selectedBiller,
    selectedBillItemIdentifier,
    selectedBillItemPathLabel,
    setIsSubmitting: updateSubmitting,
    type,
    verifiedCustomerName,
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
    verifiedCustomerName,
    payment,
    resetVerification,
    scheduleNextStepScroll,
    scrollViewRef,
    selectedBiller,
    selectedBillItemIdentifier,
    setProviderPickerExpanded: setIsProviderPickerExpanded,
    setRepeatPaymentActive: (isActive: boolean) => {
      if (!isActive) {
        deactivateRepeatPayment();
        return;
      }
      setIsRepeatPaymentActive(true);
    },
    shouldScrollToNextStep,
    updateAmount: setAmount,
    updateCustomerId: (value: string) => {
      setCustomerId(value);
      resetVerification();
    },
    verify,
    insets,
  };
}
