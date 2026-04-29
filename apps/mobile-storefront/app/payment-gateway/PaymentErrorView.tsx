import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors, { BRAND } from '@/constants/Colors';
import { paymentGatewayStyles as styles } from './payment-gateway.styles';

interface PaymentErrorViewProps {
  colors: typeof Colors.light;
  errorMessage: string | null;
  gatewayName: string;
  onBack: () => void;
  onRetry: () => void;
}

export function PaymentErrorView({
  colors,
  errorMessage,
  gatewayName,
  onBack,
  onRetry,
}: PaymentErrorViewProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: gatewayName,
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Close payment error"
              accessibilityRole="button"
              onPress={onBack}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.statusContainer}>
        <View
          style={[styles.statusIcon, { backgroundColor: `${colors.error}20` }]}
        >
          <Ionicons name="alert-circle" size={48} color={colors.error} />
        </View>
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          Payment Failed
        </Text>
        {errorMessage ? (
          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
        ) : null}
        <View style={styles.errorActions}>
          <Pressable
            accessibilityRole="button"
            style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
            onPress={onRetry}
          >
            <Text style={styles.actionButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={onBack}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
