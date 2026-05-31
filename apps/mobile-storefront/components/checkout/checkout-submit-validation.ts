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
  resolvedShippingQuoteContextKey: string;
  selectedPayment: PaymentMethodType;
  selectedQuote: ShippingQuote | undefined;
  setStep: (step: 'address' | 'payment' | 'review') => void;
}

export function validateCheckoutSubmission({
  availablePaymentMethods,
  currentShippingQuoteContextKey,
  deliveryMethod,
  isLoadingQuotes,
  isOrderInFlight,
  isProcessing,
  itemsLength,
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
    availablePaymentMethods.length > 0 &&
    !availablePaymentMethods.includes(selectedPayment)
  ) {
    Alert.alert(
      'Payment Method Unavailable',
      'The selected payment method is no longer available. Please choose another.',
      [{ text: 'OK', onPress: () => setStep('payment') }]
    );
    return false;
  }

  const requiresFreshShippingQuote =
    deliveryMethod === 'door' && Boolean(currentShippingQuoteContextKey);
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
