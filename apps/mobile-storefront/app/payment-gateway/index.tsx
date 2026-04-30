/**
 * Payment Gateway WebView Screen
 * Handles card payment checkout via Paystack, Korapay, and Juicyway
 */

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { InvalidCheckoutView } from './InvalidCheckoutView';
import { PaymentErrorView } from './PaymentErrorView';
import { PaymentGatewayCheckoutView } from './PaymentGatewayCheckoutView';
import { PaymentProcessingView } from './PaymentProcessingView';
import { PaymentSuccessView } from './PaymentSuccessView';
import { usePaymentGatewayController } from './use-payment-gateway-controller';

export default function PaymentGatewayScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const controller = usePaymentGatewayController();

  if (!controller.validatedParams.isValid) {
    return (
      <InvalidCheckoutView
        colors={colors}
        error={controller.validatedParams.error}
        onBack={controller.handleBack}
      />
    );
  }

  if (controller.status === 'processing') {
    return <PaymentProcessingView colors={colors} />;
  }

  if (controller.status === 'success') {
    return (
      <PaymentSuccessView
        colors={colors}
        paymentKind={controller.paymentKind}
      />
    );
  }

  if (controller.status === 'error') {
    return (
      <PaymentErrorView
        colors={colors}
        errorMessage={controller.errorMessage}
        gatewayName={controller.gatewayName}
        onBack={controller.handleBack}
        onRetry={controller.handleRetry}
      />
    );
  }

  return (
    <PaymentGatewayCheckoutView
      amount={controller.amount}
      authorizationUrl={controller.authorizationUrl}
      colors={colors}
      gatewayName={controller.gatewayName}
      onClose={controller.handleClose}
      onError={controller.handleWebViewError}
      onLoadEnd={controller.handleLoadEnd}
      onLoadStart={controller.handleLoadStart}
      onMessage={controller.handleWebViewMessage}
      onNavigationStateChange={controller.handleNavigationChange}
      onShouldStartLoadWithRequest={controller.handleShouldStartLoadWithRequest}
      status={controller.status}
      ToastComponent={controller.toast.Toast}
      webViewRef={controller.webViewRef}
    />
  );
}
