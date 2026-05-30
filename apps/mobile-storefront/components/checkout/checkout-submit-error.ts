import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { PaymentMethodType } from '@/components/checkout/PaymentMethodSelector';
import { trackError } from '@/services/analytics';
import { OrderError } from '@/services/orders';

export function handleCheckoutSubmitError(
  error: unknown,
  selectedPayment: PaymentMethodType
) {
  if (error instanceof OrderError) {
    trackError('checkout_failed', error.message, {
      step: 'place_order',
      paymentMethod: selectedPayment,
      errorCode: error.code,
    });

    if (error.code === 'NETWORK_ERROR') {
      Alert.alert(
        'No Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (error.code === 'VALIDATION_ERROR') {
      Alert.alert(
        'Invalid Information',
        error.message || 'Please check your order details and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (error.code === 'AUTH_ERROR') {
      Alert.alert(
        'Session Expired',
        'Please sign in again to complete your order.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    Alert.alert(
      'Order Failed',
      error.message || 'Something went wrong. Please try again.',
      [{ text: 'OK' }]
    );
    return;
  }

  trackError(
    'checkout_failed',
    error instanceof Error ? error.message : 'Unknown error',
    { step: 'place_order', paymentMethod: selectedPayment }
  );
  Alert.alert('Error', 'Failed to place order. Please try again.', [
    { text: 'OK' },
  ]);
}
