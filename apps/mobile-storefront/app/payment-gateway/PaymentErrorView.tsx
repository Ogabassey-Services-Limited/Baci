import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paymentGatewayStyles as styles } from '@/app/payment-gateway/payment-gateway.styles';
import type Colors from '@/constants/Colors';
import { BRAND, withAlpha } from '@/constants/Colors';

interface PaymentErrorViewProps {
  colors: typeof Colors.light;
  errorMessage: string | null;
  gatewayName: string;
  onBack: () => void;
  onRetry: () => Promise<void> | void;
}

export function PaymentErrorView({
  colors,
  errorMessage,
  gatewayName,
  onBack,
  onRetry,
}: PaymentErrorViewProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRetry = async () => {
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      if (mountedRef.current) {
        setIsRetrying(false);
      }
    }
  };

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
          style={[
            styles.statusIcon,
            { backgroundColor: withAlpha(colors.error, 0.125) },
          ]}
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
            accessibilityLabel="Try payment again"
            accessibilityRole="button"
            accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
            disabled={isRetrying}
            style={[
              styles.baseButton,
              {
                backgroundColor: BRAND.primary,
                opacity: isRetrying ? 0.75 : 1,
              },
            ]}
            onPress={handleRetry}
          >
            {isRetrying ? (
              <ActivityIndicator color={BRAND.onPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>Try Again</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={[
              styles.baseButton,
              styles.secondaryButton,
              { borderColor: colors.border },
            ]}
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
