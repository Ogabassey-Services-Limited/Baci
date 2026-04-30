import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paymentGatewayStyles as styles } from '@/app/payment-gateway/payment-gateway.styles';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';

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
      <Stack.Screen
        options={{ headerShown: false, title: 'Invalid Checkout' }}
      />
      <View style={styles.centeredContainer}>
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
          style={[styles.baseButton, { backgroundColor: BRAND.primary }]}
          onPress={onBack}
        >
          <Text style={styles.actionButtonText}>Go Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
