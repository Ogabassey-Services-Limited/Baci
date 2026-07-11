import { router } from 'expo-router';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import type { PaymentMethodType } from '@/components/checkout/PaymentMethodSelector';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';

interface ValidateCheckoutSubmissionParams {
  availablePaymentMethods: PaymentMethodType[];
  currentShippingQuoteContextKey: string;
  deliveryMethod: DeliveryMethod;
  isLoadingQuotes: boolean;
  isOrderInFlight: MutableRefObject<boolean>;
  isProcessing: boolean;
  itemsLength: number;
  requiresShippingQuote: boolean;
  resolvedShippingQuoteContextKey: string;
  selectedPayment: PaymentMethodType | null;
  selectedQuote: ShippingQuote | undefined;
  setStep: (step: 'address' | 'payment' | 'review') => void;
}

export function validateCheckoutSubmission({
  availablePaymentMethods,
  currentShippingQuoteContextKey,
  isLoadingQuotes,
  isOrderInFlight,
  isProcessing,
  itemsLength,
  requiresShippingQuote,
  resolvedShippingQuoteContextKey,
  selectedPayment,
  selectedQuote,
  setStep,
}: ValidateCheckoutSubmissionParams): boolean {
  if (itemsLength === 0) {
    Alert.alert(
      'Empty Cart',
      'Your cart is empty. Please add items before checking out.',
      [{ text: 'OK', onPress: () => router.replace('/') }]
    );
    return false;
  }

  if (isOrderInFlight.current || isProcessing) return false;

  if (isLoadingQuotes) {
    Alert.alert(
      'Still Fetching Delivery',
      'Please wait for delivery options to finish loading before placing your order.'
    );
    return false;
  }

  if (
    !selectedPayment ||
    (availablePaymentMethods.length > 0 &&
      !availablePaymentMethods.includes(selectedPayment))
  ) {
    Alert.alert(
      'Payment Method Unavailable',
      'The selected payment method is no longer available. Please choose another.',
      [{ text: 'OK', onPress: () => setStep('payment') }]
    );
    return false;
  }

  const requiresFreshShippingQuote =
    requiresShippingQuote && Boolean(currentShippingQuoteContextKey);
  const hasFreshShippingQuoteSelection =
    resolvedShippingQuoteContextKey === currentShippingQuoteContextKey &&
    Boolean(selectedQuote);

  if (requiresFreshShippingQuote && !hasFreshShippingQuoteSelection) {
    Alert.alert(
      'Shipping Required',
      'Please confirm a delivery option before placing your order.',
      [{ text: 'OK', onPress: () => setStep('address') }]
    );
    return false;
  }

  return true;
}
