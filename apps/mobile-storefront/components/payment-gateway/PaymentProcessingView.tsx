import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paymentGatewayStyles as styles } from '@/components/payment-gateway/payment-gateway.styles';
import type Colors from '@/constants/Colors';

interface PaymentProcessingViewProps {
  colors: typeof Colors.light;
  paymentKind?: string;
  utilityType?: string;
}

export function PaymentProcessingView({
  colors,
  paymentKind,
  utilityType,
}: PaymentProcessingViewProps) {
  const isVtuPayment = paymentKind === 'vtu';
  const isTokenUtility =
    isVtuPayment &&
    (utilityType === 'power' || utilityType === 'tv' || utilityType === 'gaming');
  const accessibilityLabel = isVtuPayment
    ? isTokenUtility
      ? 'Generating utility token'
      : 'Completing utility purchase'
    : 'Confirming payment';
  const title = isVtuPayment ? 'Payment Received' : 'Confirming Payment';
  const message = isTokenUtility
    ? "We're generating your token now. This usually takes 30-60 seconds, and we'll notify you when it's ready."
    : isVtuPayment
      ? "We're completing your utility purchase now. This usually takes a few seconds."
      : "We're confirming your payment and receipt. This usually takes a few seconds.";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.centeredContainer}>
        <ActivityIndicator
          accessible={true}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="progressbar"
          size="large"
          color={colors.primary}
        />
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}
