import Ionicons from '@react-native-vector-icons/ionicons';
import { Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BNPLCheckoutStatusView } from '@/components/bnpl-checkout/BNPLCheckoutStatusView';
import { bnplCheckoutScreenStyles as styles } from './BNPLCheckoutScreen.styles';
import { BNPLCheckoutWebView } from './BNPLCheckoutWebView';
import { useBNPLCheckoutController } from './useBNPLCheckoutController';

export function BNPLCheckoutScreen() {
  const checkout = useBNPLCheckoutController();

  if (!checkout.validatedParams.isValid) {
    return (
      <BNPLCheckoutStatusView
        colors={checkout.colors}
        message={checkout.validatedParams.error}
        onBack={checkout.handleBack}
        variant="invalid"
      />
    );
  }

  if (checkout.status === 'success') {
    return (
      <BNPLCheckoutStatusView
        colors={checkout.colors}
        gatewayName={checkout.gatewayName}
        variant="success"
      />
    );
  }

  if (checkout.status === 'error') {
    return (
      <BNPLCheckoutStatusView
        colors={checkout.colors}
        gatewayName={checkout.gatewayName}
        message={checkout.errorMessage}
        onBack={checkout.handleBack}
        onRetry={checkout.handleRetry}
        variant="error"
      />
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: checkout.colors.background },
      ]}
      edges={['top']}
    >
      <Stack.Screen
        options={{
          title: checkout.gatewayName,
          headerShown: true,
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Close checkout"
              accessibilityRole="button"
              onPress={checkout.handleClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={checkout.colors.text} />
            </Pressable>
          ),
        }}
      />

      <BNPLCheckoutWebView
        amount={checkout.amount}
        bnplUrl={checkout.bnplUrl}
        colors={checkout.colors}
        currentUrl={checkout.currentUrl}
        gatewayName={checkout.gatewayName}
        onError={checkout.handleWebViewError}
        onHttpError={checkout.handleWebViewHttpError}
        onLoadEnd={checkout.handleLoadEnd}
        onLoadStart={checkout.handleLoadStart}
        onMessage={checkout.handleWebViewMessage}
        onNavigationStateChange={checkout.handleNavigationChange}
        onOpenWindow={checkout.handleOpenWindow}
        onShouldStartLoadWithRequest={checkout.handleShouldStartLoadWithRequest}
        status={checkout.status}
        webViewRef={checkout.webViewRef}
      />
    </SafeAreaView>
  );
}
