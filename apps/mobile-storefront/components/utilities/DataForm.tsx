import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller } from '@/hooks/use-vtu-billers';
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { detectNetwork } from '@/lib/network-utils';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { useAuthStore } from '@/stores/auth-store';
import { BillerList } from './BillerList';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';
import { formatUtilityAmountInput } from './utility-amount-format';

/** Height reserved for the absolutely-positioned payment footer */
const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;

type DataProvider = 'mtn' | 'airtel' | 'glo' | 't2';

function inferProviderFromDataBillerName(name: string): DataProvider | null {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes('mtn')) {
    return 'mtn';
  }
  if (normalizedName.includes('airtel')) {
    return 'airtel';
  }
  if (normalizedName.includes('glo')) {
    return 'glo';
  }
  if (
    normalizedName.includes('9mobile') ||
    normalizedName.includes('9 mobile') ||
    normalizedName.includes('etisalat') ||
    normalizedName.includes('t2')
  ) {
    return 't2';
  }

  return null;
}

interface DataFormProps {
  onSuccess: (data: {
    reference: string;
    amount: number;
    customerIdentifier?: string;
    status?: 'processing' | 'successful';
    voucherPin?: string;
    cashback?: { amount: number; newBalance: number };
  }) => void;
  initialAmount?: string;
  initialPhoneNumber?: string;
  initialPlan?: string;
  initialProvider?: string;
  isRepeatPaymentReady?: boolean;
}

export function DataForm({
  initialAmount,
  initialPhoneNumber,
  initialPlan,
  initialProvider,
  isRepeatPaymentReady = false,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shouldScrollToPaymentRef = useRef(isRepeatPaymentReady);
  const wasRepeatPaymentReadyRef = useRef(isRepeatPaymentReady);
  const paymentYRef = useRef<number | null>(null);
  const formattedPlanAmount = formatUtilityAmountInput(planAmount);
  const footerSpacerHeight =
    FOOTER_HEIGHT + Math.max(insets.bottom, SPACING.md) + FOOTER_ERROR_BUFFER;
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

  // Bug #H18: Guard against double-tap with isSubmitting state (same pattern as AirtimeForm)
  const isBusy = isSubmitting;

  useEffect(() => {
    if (!wasRepeatPaymentReadyRef.current && isRepeatPaymentReady) {
      shouldScrollToPaymentRef.current = true;
      if (paymentYRef.current !== null) {
        const paymentY = paymentYRef.current;
        shouldScrollToPaymentRef.current = false;
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({
            animated: true,
            y: Math.max(paymentY - SPACING.md, 0),
          });
        });
      }
    }
    wasRepeatPaymentReadyRef.current = isRepeatPaymentReady;
  }, [isRepeatPaymentReady]);

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

  useEffect(() => {
    if (selectedDataBiller || !initialPlan || !dataPlans?.length) {
      return;
    }

    const matchedPlan =
      dataPlans.find((plan) => plan.billerId === initialPlan) ?? null;
    if (!matchedPlan) {
      return;
    }

    setSelectedDataBiller(matchedPlan);
    setSelectedPlan(matchedPlan.billerId);
    setSelectedProvider(
      inferProviderFromDataBillerName(matchedPlan.billerName) ??
        initialProvider ??
        null
    );
    setIsDataPickerExpanded(false);
  }, [dataPlans, initialPlan, initialProvider, selectedDataBiller]);

  const handleDataBillerSelect = (biller: Biller) => {
    setSelectedDataBiller(biller);
    setSelectedPlan(biller.billerId);
    setSelectedProvider(
      inferProviderFromDataBillerName(biller.billerName) ??
        detectNetwork(phoneNumber) ??
        selectedProvider
    );
    setIsDataPickerExpanded(false);
  };

  const handlePurchase = async () => {
    dismissKeyboard();

    // Bug #H18: Prevent double-tap duplicate purchases
    if (isBusy) return;

    if (!selectedProvider || !phoneNumber || !selectedPlan) {
      Alert.alert(
        'Missing Information',
        'Please enter a phone number and choose a data bundle.'
      );
      return;
    }
    // Bug #64: Prevent submission when planAmount is 0 or not set
    if (planAmount <= 0) {
      Alert.alert(
        'Invalid Amount',
        'Please enter a valid amount before proceeding.'
      );
      return;
    }
    if (!payment.selectedSavedCardId && !payment.selectedGateway) {
      Alert.alert(
        'Select Payment Method',
        'Choose a payment method before continuing.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        customer?.email;

      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          amount: planAmount,
          customerName,
          customerPhone: customer?.phone,
          dataPlanCode: selectedPlan,
          networkProvider: selectedProvider,
          phoneNumber,
          savedPaymentMethodId: payment.selectedSavedCardId,
          type: 'data',
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(planAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: phoneNumber,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: 'data',
            },
          });
          return;
        }

        if (isSavedVtuCardChargeProcessing(result)) {
          try {
            const confirmed = await waitForVtuConfirmation({
              gateway: 'paystack',
              reference: result.reference,
            });
            onSuccess({
              amount: confirmed.amount ?? planAmount,
              cashback: confirmed.cashback
                ? {
                    amount: confirmed.cashback.amount,
                    newBalance: confirmed.cashback.newBalance,
                  }
                : undefined,
              reference: confirmed.reference,
              voucherPin: confirmed.voucherPin,
            });
          } catch (error) {
            if (error instanceof VtuPaymentStillProcessingError) {
              onSuccess({
                amount: error.amount ?? planAmount,
                customerIdentifier: error.customerIdentifier ?? phoneNumber,
                reference: error.reference,
                status: 'processing',
              });
              return;
            }

            throw error;
          }
          return;
        }

        onSuccess({
          amount: result.amount,
          cashback: result.cashback
            ? {
                amount: result.cashback.amount,
                newBalance: result.cashback.newBalance,
              }
            : undefined,
          reference: result.reference,
          voucherPin: result.voucherPin,
        });
        return;
      }

      const result = await initializeVtuCheckout({
        amount: planAmount,
        customerName,
        customerPhone: customer?.phone,
        dataPlanCode: selectedPlan,
        gateway: payment.selectedGateway,
        networkProvider: selectedProvider,
        phoneNumber,
        type: 'data',
      });
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(planAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: phoneNumber,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: 'data',
        },
      });
    } catch (error) {
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Phone Number
        </Text>
        <TextInput
          style={[
            styles.input,
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

        <Text
          style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}
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

        {/* Manual amount fallback */}
        <View style={[styles.inputGroup, { marginTop: 16 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Amount (₦)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Enter amount"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            accessibilityLabel="Amount"
            value={formattedPlanAmount}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '');
              setPlanAmount(digits ? Number(digits) : 0);
            }}
          />
        </View>

        <View
          onLayout={(event) => {
            paymentYRef.current = event.nativeEvent.layout.y;
            if (!shouldScrollToPaymentRef.current) {
              return;
            }

            const paymentY = paymentYRef.current;
            shouldScrollToPaymentRef.current = false;
            requestAnimationFrame(() => {
              scrollViewRef.current?.scrollTo({
                animated: true,
                y: Math.max(paymentY - SPACING.md, 0),
              });
            });
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
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.muted,
            bottom: footerBottomOffset,
            paddingBottom: isKeyboardVisible
              ? SPACING.sm
              : Math.max(insets.bottom, SPACING.md),
          },
        ]}
      >
        <Pressable
          style={[
            styles.payButton,
            {
              backgroundColor: BRAND.primary,
              opacity: isBusy ? 0.7 : 1,
            },
          ]}
          onPress={handlePurchase}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.payButtonText}>
              {payment.selectedSavedCardId
                ? `Pay ₦${planAmount ? planAmount.toLocaleString() : '0'}`
                : 'Continue to Payment'}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
  },
  payButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
