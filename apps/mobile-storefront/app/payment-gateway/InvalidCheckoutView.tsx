import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors, { BRAND } from '@/constants/Colors';
import { paymentGatewayStyles as styles } from './payment-gateway.styles';

interface InvalidCheckoutViewProps {
  colors: typeof Colors.light;
  error: string | null;
  onBack: () => void;
}

export function InvalidCheckoutView({
  colors,
  error,
  onBack,
}: InvalidCheckoutViewProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={BRAND.primary} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Invalid Checkout
        </Text>
        {error ? (
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityHint="Navigate to the previous screen"
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
          onPress={onBack}
        >
          <Text style={styles.actionButtonText}>Go Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
