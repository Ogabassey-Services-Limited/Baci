import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, type LayoutChangeEvent, type ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/Colors';
import { NETWORK_PROVIDERS } from '@/constants/network-providers';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import {
  chargeSavedVtuCard,
  chargeWalletForVtu,
  computeVtuWalletAmount,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  shouldRotateWalletIdempotencyKeyForError,
  type VtuConfirmationGateway,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { useAuthStore } from '@/stores/auth-store';
import type { AirtimeFormProps } from './airtime-form.types';
import {
  buildAirtimeGatewayParams,
  getAirtimeCustomerName,
  resolveAirtimeProvider,
  sanitizeAirtimeAmountInput,
  sanitizePhoneDigits,
  scrollToAirtimePaymentSection,
  validateAirtimePurchaseInput,
} from './airtime-form-controller.helpers';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { formatUtilityAmountInput } from './utility-amount-format';

const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;
const SAVED_CARD_CONFIRMATION_GATEWAY: VtuConfirmationGateway = 'paystack';

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
  const scrollViewRef = useRef<ScrollView>(null);
  const prevIsRepeatPaymentReadyRef = useRef(isRepeatPaymentReady);
  const isSubmittingRef = useRef(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(initialProvider ?? (initialPhoneNumber ? resolveAirtimeProvider(initialPhoneNumber) : null));
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '');
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNetworkPickerExpanded, setIsNetworkPickerExpanded] = useState(false);
  const [shouldScrollToPayment, setShouldScrollToPayment] = useState(isRepeatPaymentReady);
  const numericAmount = Number(amount.replace(/\D/g, ''));
  const payment = useUtilityPayment(numericAmount);
  const selectedProviderConfig = NETWORK_PROVIDERS.find((provider) => provider.id === selectedProvider) ?? null;

  useEffect(() => {
    if (!prevIsRepeatPaymentReadyRef.current && isRepeatPaymentReady) {
      setShouldScrollToPayment(true);
    }
    prevIsRepeatPaymentReadyRef.current = isRepeatPaymentReady;
  }, [isRepeatPaymentReady]);

  const handlePhoneChange = (text: string) => {
    const digits = sanitizePhoneDigits(text);
    setPhoneNumber(digits);
    setSelectedProvider(resolveAirtimeProvider(digits));
    setIsNetworkPickerExpanded(false);
  };

  const updateAmount = (value: string) => {
    setAmount(sanitizeAirtimeAmountInput(value));
  };

  const handlePurchase = async () => {
    dismissKeyboard();
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    const walletAmount = computeVtuWalletAmount(
      payment.walletSelection?.use === true ? payment.walletSelection.amount : 0,
      numericAmount
    );
    const isWalletOnly = walletAmount > 0 && walletAmount === numericAmount;

    const validationError = validateAirtimePurchaseInput({
      amount,
      isWalletOnly,
      numericAmount,
      phoneNumber,
      selectedGateway: payment.selectedGateway,
      selectedProvider,
      selectedSavedCardId: payment.selectedSavedCardId,
    });
    if (validationError) {
      Alert.alert(validationError.title, validationError.message);
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);
    let didNavigate = false;
    try {
      const customerName = getAirtimeCustomerName(customer);

      if (isWalletOnly) {
        const idempotencyKey = payment.getWalletIdempotencyKey();
        try {
          const result = await chargeWalletForVtu({
            amount: numericAmount,
            customerName,
            customerPhone: customer?.phone,
            networkProvider: selectedProvider ?? undefined,
            phoneNumber,
            type: 'airtime',
            walletAmount: numericAmount,
            idempotencyKey,
          });
          if (result.status === 'processing') {
            onSuccess({
              amount: result.amount ?? numericAmount,
              customerIdentifier: phoneNumber,
              reference: result.reference,
              status: 'processing',
            });
            return;
          }
          payment.resetWalletIdempotencyKey();
          onSuccess({
            amount: result.amount ?? numericAmount,
            cashback: result.cashback,
            reference: result.reference,
            status: 'successful',
            voucherPin: result.voucherPin,
          });
          return;
        } catch (error) {
          if (shouldRotateWalletIdempotencyKeyForError(error)) {
            payment.resetWalletIdempotencyKey();
          }
          throw error;
        }
      }

      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          amount: numericAmount,
          customerName,
          customerPhone: customer?.phone,
          networkProvider: selectedProvider ?? undefined,
          phoneNumber,
          savedPaymentMethodId: payment.selectedSavedCardId,
          type: 'airtime',
          ...(walletAmount > 0 ? { walletAmount } : {}),
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: buildAirtimeGatewayParams({
              amount: numericAmount,
              authorizationUrl: result.authorization_url,
              customerIdentifier: phoneNumber,
              gateway: result.gateway,
              reference: result.reference,
            }),
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
        throw new Error('A payment gateway must be selected before checkout.');
      }

      const result = await initializeVtuCheckout({
        type: 'airtime',
        amount: numericAmount,
        customerName,
        customerPhone: customer?.phone,
        gateway: selectedGateway,
        networkProvider: selectedProvider ?? undefined,
        phoneNumber,
        ...(walletAmount > 0 ? { walletAmount } : {}),
      });
      router.push({
        pathname: '/payment-gateway',
        params: buildAirtimeGatewayParams({
          amount: numericAmount,
          authorizationUrl: result.authorization_url,
          customerIdentifier: phoneNumber,
          gateway: result.gateway,
          reference: result.reference,
        }),
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
    scrollToAirtimePaymentSection({
      event,
      scrollViewRef,
      setShouldScrollToPayment,
      shouldScrollToPayment,
    });
  };

  return {
    amount,
    footerBottomOffset: getUtilityFooterOffset({
      bottomInset: insets.bottom,
      isKeyboardVisible,
      keyboardHeight,
    }),
    footerSpacerHeight: FOOTER_HEIGHT + Math.max(insets.bottom, SPACING.md) + FOOTER_ERROR_BUFFER,
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
