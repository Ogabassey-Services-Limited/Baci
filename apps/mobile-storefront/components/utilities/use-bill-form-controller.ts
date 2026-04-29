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
import { createBillFormPurchaseHandler } from './create-bill-form-purchase-handler';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { useNextStepScroll } from './use-next-step-scroll';
import { formatUtilityAmountInput } from './utility-amount-format';

function parseUtilityAmount(value: string): number {
  const withoutCommas = value.trim().replace(/,/g, '');
  const isNegative = withoutCommas.startsWith('-');
  const digitsAndDecimals = withoutCommas.replace(/[^0-9.]/g, '');
  const [whole = '', ...decimalParts] = digitsAndDecimals.split('.');
  const normalized = `${isNegative ? '-' : ''}${whole}${
    decimalParts.length ? `.${decimalParts.join('')}` : ''
  }`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  const pendingVerificationKeyRef = useRef<string | null>(null);
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
  const currentVerificationKey = `${selectedBiller?.billerId ?? ''}:${
    selectedBillItemIdentifier ?? ''
  }:${customerId.trim()}`;
  const canShowPayment = Boolean(
    isRepeatPaymentActive || verifiedSelectionKey === currentVerificationKey
  );

  useEffect(() => {
    if (verify.data?.verified && pendingVerificationKeyRef.current) {
      setVerifiedSelectionKey(pendingVerificationKeyRef.current);
      pendingVerificationKeyRef.current = null;
    }
  }, [verify.data?.verified]);

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
    pendingVerificationKeyRef.current = null;
    setVerifiedSelectionKey(null);
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
    pendingVerificationKeyRef.current = currentVerificationKey;
    verify.mutate({
      billItemIdentifier: selectedBillItemIdentifier,
      customerIdentifier: customerId,
    });
  };

  const handlePurchase = createBillFormPurchaseHandler({
    amount,
    billType,
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

  const updateAmount = (value: string) => {
    setAmount(value);
  };

  const updateCustomerId = (value: string) => {
    setCustomerId(value);
    resetVerification();
  };

  const setProviderPickerExpanded = (isExpanded: boolean) => {
    setIsProviderPickerExpanded(isExpanded);
  };

  const setRepeatPaymentActive = (isActive: boolean) => {
    setIsRepeatPaymentActive(isActive);
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
    setRepeatPaymentActive,
    setProviderPickerExpanded,
    shouldScrollToNextStep,
    updateAmount,
    updateCustomerId,
    verify,
    insets,
  };
}
