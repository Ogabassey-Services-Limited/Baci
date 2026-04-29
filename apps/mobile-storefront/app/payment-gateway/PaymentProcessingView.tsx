import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors, { BRAND } from '@/constants/Colors';
import { paymentGatewayStyles as styles } from './payment-gateway.styles';

interface PaymentProcessingViewProps {
  colors: typeof Colors.light;
}

export function PaymentProcessingView({ colors }: PaymentProcessingViewProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.statusContainer}>
        <ActivityIndicator size="large" color={BRAND.primary} />
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
