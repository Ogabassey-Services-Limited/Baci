import { router } from 'expo-router';
import { Alert } from 'react-native';

const ORDER_SUCCESS_NAVIGATION_DELAY_MS = 1000;

type BNPLOrderSuccessNavigationInput = {
  gateway?: string;
  orderId?: string;
  reference?: string | null;
  trackingToken?: string;
};

export function createBNPLCheckoutAppNavigation() {
  let orderSuccessTimeout: ReturnType<typeof setTimeout> | null = null;

  const returnToApp = () => {
    router.back();
  };

  const cancelOrderSuccessNavigation = () => {
    if (!orderSuccessTimeout) {
      return;
    }
    clearTimeout(orderSuccessTimeout);
    orderSuccessTimeout = null;
  };

  const scheduleOrderSuccess = ({
    gateway,
    orderId,
    reference,
    trackingToken,
  }: BNPLOrderSuccessNavigationInput) => {
    cancelOrderSuccessNavigation();
    orderSuccessTimeout = setTimeout(() => {
      orderSuccessTimeout = null;
      router.replace({
        pathname: '/order-success',
        params: {
          orderId,
          paymentMethod: gateway,
          ...(reference && { reference }),
          ...(trackingToken && { trackingToken }),
        },
      });
    }, ORDER_SUCCESS_NAVIGATION_DELAY_MS);
  };

  const showCancelAlert = (onConfirmCancel = returnToApp) => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel this payment?',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: onConfirmCancel,
        },
      ]
    );
  };

  return {
    cancelOrderSuccessNavigation,
    returnToApp,
    scheduleOrderSuccess,
    showCancelAlert,
  };
}
