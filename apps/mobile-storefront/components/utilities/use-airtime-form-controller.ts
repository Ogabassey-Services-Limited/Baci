import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, type LayoutChangeEvent, type ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/Colors';
import { NETWORK_PROVIDERS } from '@/constants/network-providers';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import { detectNetwork } from '@/lib/network-utils';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  type VTUPaymentGateway,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { useAuthStore } from '@/stores/auth-store';
import type { AirtimeFormProps } from './airtime-form.types';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { formatUtilityAmountInput } from './utility-amount-format';

const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;
const SAVED_CARD_CONFIRMATION_GATEWAY: VTUPaymentGateway = 'paystack';

export function useAirtimeFormController({
  initialAmount,
  initialPhoneNumber,
  initialProvider,
  isRepeatPaymentReady = false,
  onSuccess,
}: AirtimeFormProps) {
  const insets = useSafeAreaInsets();
  const { dismissKeyboard, isKeyboardVisible, keyboardHeight } = useKeyboard();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();
  const scrollViewRef = useRef<ScrollView>(null);
  const prevIsRepeatPaymentReadyRef = useRef(isRepeatPaymentReady);
  const isSubmittingRef = useRef(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    initialProvider ??
      (initialPhoneNumber ? detectNetwork(initialPhoneNumber) : null)
  );
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '');
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNetworkPickerExpanded, setIsNetworkPickerExpanded] = useState(false);
  const [shouldScrollToPayment, setShouldScrollToPayment] =
    useState(isRepeatPaymentReady);
  const numericAmount = Number(amount.replace(/\D/g, ''));
  const selectedProviderConfig =
    NETWORK_PROVIDERS.find((provider) => provider.id === selectedProvider) ??
    null;

  useEffect(() => {
    if (!prevIsRepeatPaymentReadyRef.current && isRepeatPaymentReady) {
      setShouldScrollToPayment(true);
    }
    prevIsRepeatPaymentReadyRef.current = isRepeatPaymentReady;
  }, [isRepeatPaymentReady]);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
    if (!digits) {
      setSelectedProvider(null);
      setIsNetworkPickerExpanded(false);
      return;
    }

    const detected = detectNetwork(digits);
    if (detected) {
      setSelectedProvider(detected);
      setIsNetworkPickerExpanded(false);
      return;
    }
  };

  const updateAmount = (value: string) => {
    setAmount(value.replace(/\D/g, ''));
  };

  const handlePurchase = async () => {
    dismissKeyboard();
    // isSubmittingRef blocks duplicate taps synchronously; isSubmitting drives UI state.
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    if (!selectedProvider || !phoneNumber || !amount) {
      Alert.alert('Missing Information', 'Please fill in all fields.');
      isSubmittingRef.current = false;
      return;
    }
    if (numericAmount < 50 || numericAmount > 50_000) {
      Alert.alert('Invalid Amount', 'Amount must be between ₦50 and ₦50,000.');
      isSubmittingRef.current = false;
      return;
    }
    if (!payment.selectedSavedCardId && !payment.selectedGateway) {
      Alert.alert(
        'Select Payment Method',
        'Choose a payment method before continuing.'
      );
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);
    let didNavigate = false;
    try {
      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        // Email is the best available customer label when names are incomplete.
        customer?.email ||
        'Customer';
      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          amount: numericAmount,
          customerName,
          customerPhone: customer?.phone,
          networkProvider: selectedProvider,
          phoneNumber,
          savedPaymentMethodId: payment.selectedSavedCardId,
          type: 'airtime',
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(numericAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: phoneNumber,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: 'airtime',
            },
          });
          didNavigate = true;
          return;
        }

        if (isSavedVtuCardChargeProcessing(result)) {
          try {
            const confirmationGateway =
              result.gateway ?? SAVED_CARD_CONFIRMATION_GATEWAY;
            const confirmed = await waitForVtuConfirmation({
              gateway: confirmationGateway,
              reference: result.reference,
            });
            onSuccess({
              amount: confirmed.amount ?? numericAmount,
              cashback: confirmed.cashback,
              reference: confirmed.reference,
              status: 'successful',
              voucherPin: confirmed.voucherPin,
            });
          } catch (error) {
            if (error instanceof VtuPaymentStillProcessingError) {
              onSuccess({
                amount: error.amount ?? numericAmount,
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
          cashback: result.cashback,
          reference: result.reference,
          status: 'successful',
          voucherPin: result.voucherPin,
        });
        return;
      }

      const selectedGateway = payment.selectedGateway;
      if (!selectedGateway) {
        Alert.alert(
          'Select Payment Method',
          'Choose a payment method before continuing.'
        );
        return;
      }

      const result = await initializeVtuCheckout({
        type: 'airtime',
        amount: numericAmount,
        customerName,
        customerPhone: customer?.phone,
        gateway: selectedGateway,
        networkProvider: selectedProvider,
        phoneNumber,
      });
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(numericAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: phoneNumber,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: 'airtime',
        },
      });
      didNavigate = true;
    } catch (error) {
      console.error('Airtime purchase failed:', error);
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      if (!didNavigate) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

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
    footerBottomOffset: getUtilityFooterOffset({
      bottomInset: insets.bottom,
      isKeyboardVisible,
      keyboardHeight,
    }),
    footerSpacerHeight:
      FOOTER_HEIGHT + Math.max(insets.bottom, SPACING.md) + FOOTER_ERROR_BUFFER,
    formattedAmount: formatUtilityAmountInput(amount),
    handlePaymentLayout,
    handlePhoneChange,
    handleProviderSelect: (provider: string) => {
      setSelectedProvider(provider);
      setIsNetworkPickerExpanded(false);
    },
    handlePurchase,
    insets,
    isSubmitting,
    isKeyboardVisible,
    isNetworkPickerExpanded,
    numericAmount,
    payment,
    phoneNumber,
    scrollViewRef,
    selectedProvider,
    selectedProviderConfig,
    setAmount: updateAmount,
    setIsNetworkPickerExpanded,
  };
}
