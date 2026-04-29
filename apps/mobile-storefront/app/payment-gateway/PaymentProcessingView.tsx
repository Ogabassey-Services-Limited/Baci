import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paymentGatewayStyles as styles } from '@/app/payment-gateway/payment-gateway.styles';
import type Colors from '@/constants/Colors';

interface PaymentProcessingViewProps {
  colors: typeof Colors.light;
}

export function PaymentProcessingView({ colors }: PaymentProcessingViewProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.centeredContainer}>
        <ActivityIndicator
          accessible={true}
          accessibilityLabel="Confirming utility purchase"
          accessibilityRole="progressbar"
          size="large"
          color={colors.primary}
        />
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          Confirming Utility Purchase
        </Text>
        <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
          We're confirming your token and receipt. This usually takes a few
          seconds.
        </Text>
      </View>
    </SafeAreaView>
  );
}
