import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { SPACING } from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller } from '@/hooks/use-vtu-billers';
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { detectNetwork } from '@/lib/network-utils';
import { useAuthStore } from '@/stores/auth-store';
import { BillerList } from './BillerList';
import { createDataFormPurchaseHandler } from './create-data-form-purchase-handler';
import { DataAmountInput } from './DataAmountInput';
import { DataFormFooter } from './DataFormFooter';
import { DataPlanSelectionSection } from './DataPlanSelectionSection';
import {
  inferProviderFromDataBillerName,
  scrollToDataPayment,
} from './data-form.helpers';
import {
  DATA_FOOTER_ERROR_BUFFER,
  DATA_FOOTER_HEIGHT,
  dataFormStyles,
} from './data-form.styles';
import type { DataFormProps } from './data-form.types';
import { findDataPlanByCode } from './data-plan-selection';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { RecentUtilityRecipients } from './RecentUtilityRecipients';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';
import { useDataBillerInitialization } from './use-data-biller-initialization';

export function DataForm({
  initialAmount,
  initialPhoneNumber,
  initialPlan,
  initialProvider,
  isRepeatPaymentReady = false,
  recentRecipients = [],
  onSelectRecentRecipient,
  onSuccess,
}: DataFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { dismissKeyboard, isKeyboardVisible, keyboardHeight } = useKeyboard();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();
  const {
    data: dataPlans,
    error: plansError,
    isError: hasPlansError,
    isLoading: plansLoading,
  } = useVTUBillers('data');
  const scrollViewRef = useRef<ScrollView>(null);

  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    initialProvider ??
      (initialPhoneNumber ? detectNetwork(initialPhoneNumber) : null)
  );
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    initialPlan ?? null
  );
  const [selectedDataBiller, setSelectedDataBiller] = useState<Biller | null>(
    null
  );
  const [isDataPickerExpanded, setIsDataPickerExpanded] = useState(
    !initialPlan
  );
  const parsedInitialAmount = Number(initialAmount ?? 0);
  const [planAmount, setPlanAmount] = useState(
    Number.isFinite(parsedInitialAmount) ? parsedInitialAmount : 0
  );
  // Bug #H18: Guard against double-tap with isSubmitting state (same pattern as AirtimeForm)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const shouldScrollToPaymentRef = useRef(isRepeatPaymentReady);
  const wasRepeatPaymentReadyRef = useRef(isRepeatPaymentReady);
  const paymentYRef = useRef<number | null>(null);
  const footerSpacerHeight =
    DATA_FOOTER_HEIGHT +
    Math.max(insets.bottom, SPACING.md) +
    DATA_FOOTER_ERROR_BUFFER;
  const footerBottomOffset = getUtilityFooterOffset({
    bottomInset: insets.bottom,
    isKeyboardVisible,
    keyboardHeight,
  });
  const plansErrorMessage = hasPlansError
    ? plansError instanceof Error
      ? plansError.message
      : 'Could not load data bundles. Please try again.'
    : undefined;
  const selectedDataPlan = findDataPlanByCode(
    selectedDataBiller?.billItems,
    selectedPlan
  );
  const isFixedDataPlanAmount = Boolean(
    selectedDataPlan?.isAmountFixed && selectedDataPlan.amount > 0
  );

  useEffect(() => {
    if (!wasRepeatPaymentReadyRef.current && isRepeatPaymentReady) {
      shouldScrollToPaymentRef.current = true;
      if (paymentYRef.current !== null) {
        shouldScrollToPaymentRef.current = false;
        scrollToDataPayment(paymentYRef.current, scrollViewRef.current);
      }
    }
    wasRepeatPaymentReadyRef.current = isRepeatPaymentReady;
  }, [isRepeatPaymentReady]);

  useDataBillerInitialization({
    dataPlans,
    initialPlan,
    initialProvider,
    setIsDataPickerExpanded,
    setSelectedDataBiller,
    setPlanAmount,
    setSelectedPlan,
    setSelectedProvider,
  });

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
    const detected = detectNetwork(digits);
    const selectedBundleProvider = selectedDataBiller
      ? inferProviderFromDataBillerName(selectedDataBiller.billerName)
      : null;
    if (detected && !selectedBundleProvider) {
      setSelectedProvider(detected);
    }
  };

  const handleDataBillerSelect = (biller: Biller) => {
    const hasDataPackages = (biller.billItems?.length ?? 0) > 0;
    setSelectedDataBiller(biller);
    setSelectedPlan(hasDataPackages ? null : biller.billerId);
    setSelectedProvider(
      inferProviderFromDataBillerName(biller.billerName) ??
        detectNetwork(phoneNumber) ??
        selectedProvider
    );
    if (hasDataPackages) {
      setPlanAmount(0);
    }
    setIsDataPickerExpanded(false);
  };

  const handleDataPlanSelect = (
    billItem: NonNullable<typeof selectedDataPlan>
  ) => {
    setSelectedPlan(billItem.itemCode);
    setPlanAmount(billItem.amount > 0 ? billItem.amount : 0);
  };

  const handlePurchase = createDataFormPurchaseHandler({
    customer,
    dismissKeyboard,
    getIsSubmitting: () => isSubmittingRef.current,
    onSuccess,
    payment,
    phoneNumber,
    planAmount,
    selectedPlan,
    selectedProvider,
    setIsSubmitting: (next) => {
      isSubmittingRef.current = next;
      setIsSubmitting(next);
    },
  });

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={dataFormStyles.scrollView}
        contentContainerStyle={[
          dataFormStyles.content,
          { paddingBottom: footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[dataFormStyles.sectionTitle, { color: colors.text }]}>
          Phone Number
        </Text>
        <TextInput
          style={[
            dataFormStyles.input,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="08012345678"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          accessibilityLabel="Phone Number"
          value={phoneNumber}
          onChangeText={handlePhoneChange}
        />

        {recentRecipients.length > 0 && onSelectRecentRecipient ? (
          <RecentUtilityRecipients
            colors={colors}
            recipients={recentRecipients}
            onSelect={onSelectRecentRecipient}
          />
        ) : null}

        <Text
          style={[
            dataFormStyles.sectionTitle,
            { color: colors.text, marginTop: 24 },
          ]}
        >
          Select Data Bundle
        </Text>
        <BillerList
          billers={dataPlans || []}
          selectedBillerId={selectedDataBiller?.billerId ?? selectedPlan}
          onSelect={handleDataBillerSelect}
          isLoading={plansLoading}
          isCollapsed={!!selectedDataBiller && !isDataPickerExpanded}
          onChangeSelection={() => setIsDataPickerExpanded(true)}
          selectedLabel="Data Bundle"
          emptyMessage="No data bundles available"
          errorMessage={plansErrorMessage}
        />

        {selectedDataBiller?.billItems?.length ? (
          <DataPlanSelectionSection
            billItems={selectedDataBiller.billItems}
            colors={colors}
            selectedPlan={selectedPlan}
            onSelectPlan={handleDataPlanSelect}
          />
        ) : null}

        <DataAmountInput
          amount={planAmount}
          colors={colors}
          isFixedAmount={isFixedDataPlanAmount}
          onChangeAmount={setPlanAmount}
        />

        <View
          onLayout={(event) => {
            paymentYRef.current = event.nativeEvent.layout.y;
            if (!shouldScrollToPaymentRef.current) {
              return;
            }

            shouldScrollToPaymentRef.current = false;
            scrollToDataPayment(paymentYRef.current, scrollViewRef.current);
          }}
        >
          <UtilityPaymentOptions
            amount={planAmount}
            cards={payment.cards}
            isLoadingCards={payment.isLoadingCards}
            onSelectGateway={payment.selectGateway}
            onSelectSavedCard={payment.selectSavedCard}
            selectedGateway={payment.selectedGateway}
            selectedSavedCardId={payment.selectedSavedCardId}
            supportedGateways={payment.supportedGateways}
            walletBalance={payment.walletBalance}
            walletSelection={payment.walletSelection}
            onWalletToggle={payment.setWalletSelection}
          />
        </View>
      </ScrollView>

      <DataFormFooter
        bottomInset={insets.bottom}
        bottomOffset={footerBottomOffset}
        colors={colors}
        isKeyboardVisible={isKeyboardVisible}
        isSubmitting={isSubmitting}
        planAmount={planAmount}
        selectedSavedCardId={payment.selectedSavedCardId}
        onPress={handlePurchase}
      />
    </>
  );
}
