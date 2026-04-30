import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PAYMENT_KINDS,
  type PaymentKind,
} from '@/app/payment-gateway/payment-gateway.helpers';
import { paymentGatewayStyles as styles } from '@/app/payment-gateway/payment-gateway.styles';
import type Colors from '@/constants/Colors';
import { withAlpha } from '@/constants/Colors';

interface PaymentSuccessViewProps {
  colors: typeof Colors.light;
  paymentKind?: PaymentKind;
}

export function PaymentSuccessView({
  colors,
  paymentKind,
}: PaymentSuccessViewProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={styles.centeredContainer}
      >
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: withAlpha(colors.success, 0.125) },
          ]}
        >
          <Ionicons
            accessibilityLabel="Payment successful"
            name="checkmark-circle"
            size={48}
            color={colors.success}
          />
        </View>
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          Payment Successful!
        </Text>
        <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
          {paymentKind === PAYMENT_KINDS.VTU
            ? 'Redirecting to your utility confirmation...'
            : 'Redirecting to your order confirmation...'}
        </Text>
        <ActivityIndicator
          accessibilityLabel="Redirecting after payment success"
          size="small"
          color={colors.primary}
          style={styles.activityIndicator}
        />
      </View>
    </SafeAreaView>
  );
}
