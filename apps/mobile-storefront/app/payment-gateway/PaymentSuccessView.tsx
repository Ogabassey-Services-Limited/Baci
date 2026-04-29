import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { paymentGatewayStyles as styles } from './payment-gateway.styles';

interface PaymentSuccessViewProps {
  colors: typeof Colors.light;
  paymentKind?: string;
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
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: `${colors.success}20` },
          ]}
        >
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        </View>
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          Payment Successful!
        </Text>
        <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
          {paymentKind === 'vtu'
            ? 'Redirecting to your utility confirmation...'
            : 'Redirecting to your order confirmation...'}
        </Text>
        <ActivityIndicator
          size="small"
          color={BRAND.primary}
          style={{ marginTop: SPACING.lg }}
        />
      </View>
    </SafeAreaView>
  );
}
