import Ionicons from '@react-native-vector-icons/ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BNPLCheckoutStatusView } from '@/components/bnpl-checkout/BNPLCheckoutStatusView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/api-url';
import {
  normalizeBNPLRouteParams,
  type BNPLRouteParams,
} from '@/lib/bnpl-url';
import { bnplCheckoutScreenStyles as styles } from './BNPLCheckoutScreen.styles';
import { BNPLCheckoutWebView } from './BNPLCheckoutWebView';
import { useBNPLCheckoutController } from './use-bnpl-checkout-controller';

const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);

export function BNPLCheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const rawParams = useLocalSearchParams<BNPLRouteParams>();
  const params = normalizeBNPLRouteParams(rawParams);
  const checkout = useBNPLCheckoutController({
    apiBaseUrl: API_BASE_URL,
    params,
  });

  if (!checkout.validatedParams.isValid) {
    return (
      <BNPLCheckoutStatusView
        colors={colors}
        message={checkout.validatedParams.error}
        onBack={() => router.back()}
        variant="invalid"
      />
    );
  }

  if (checkout.status === 'success') {
    return (
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName={checkout.gatewayName}
        variant="success"
      />
    );
  }

  if (checkout.status === 'error') {
    return (
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName={checkout.gatewayName}
        message={checkout.errorMessage}
        onBack={() => router.back()}
        onRetry={checkout.handleRetry}
        variant="error"
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <Stack.Screen
        options={{
          title: checkout.gatewayName,
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={checkout.handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <BNPLCheckoutWebView
        amount={checkout.amount}
        bnplUrl={checkout.bnplUrl}
        colors={colors}
        currentUrl={checkout.currentUrl}
        gatewayName={checkout.gatewayName}
        onError={(description) => {
          checkout.handleLoadError(description);
        }}
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
