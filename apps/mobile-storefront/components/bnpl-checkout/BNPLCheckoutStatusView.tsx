import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SPACING, withAlpha } from '@/constants/Colors';

type ThemeColors = typeof Colors.light;

type InvalidCheckoutStatusProps = {
  colors: ThemeColors;
  message: string | null;
  onBack: () => void;
  variant: 'invalid';
};

type ErrorCheckoutStatusProps = {
  colors: ThemeColors;
  gatewayName: string;
  message: string | null;
  onBack: () => void;
  onRetry: () => void;
  variant: 'error';
};

type SuccessCheckoutStatusProps = {
  colors: ThemeColors;
  gatewayName: string;
  variant: 'success';
};

type BNPLCheckoutStatusViewProps =
  | InvalidCheckoutStatusProps
  | ErrorCheckoutStatusProps
  | SuccessCheckoutStatusProps;

export function BNPLCheckoutStatusView(props: BNPLCheckoutStatusViewProps) {
  if (props.variant === 'invalid') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: props.colors.background }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.statusContainer}>
          <Ionicons name="alert-circle" size={64} color={BRAND.primary} />
          <Text
            style={[
              styles.statusTitle,
              styles.invalidTitle,
              { color: props.colors.text },
            ]}
          >
            Invalid Checkout
          </Text>
          {props.message ? (
            <Text
              style={[
                styles.statusMessage,
                { color: props.colors.textSecondary },
              ]}
            >
              {props.message}
            </Text>
          ) : null}
          <Pressable
            accessibilityHint="Navigate to the previous screen"
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={[
              styles.primaryButton,
              styles.invalidButton,
              { backgroundColor: BRAND.primary },
            ]}
            onPress={props.onBack}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (props.variant === 'success') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: props.colors.background }]}
      >
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.statusContainer}
        >
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: withAlpha(props.colors.success, 0.125) },
            ]}
          >
            <Ionicons
              accessibilityLabel="Payment successful"
              name="checkmark-circle"
              size={48}
              color={props.colors.success}
            />
          </View>
          <Text style={[styles.statusTitle, { color: props.colors.text }]}>
            Payment Successful!
          </Text>
          <Text
            style={[
              styles.statusMessage,
              { color: props.colors.textSecondary },
            ]}
          >
            Your {props.gatewayName} payment has been approved. Redirecting to
            order confirmation...
          </Text>
          <ActivityIndicator
            accessibilityLabel="Redirecting after payment success"
            size="small"
            color={props.colors.primary}
            style={styles.statusLoader}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: props.colors.background }]}
    >
      <Stack.Screen
        options={{
          title: props.gatewayName,
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Close payment error"
              accessibilityRole="button"
              onPress={props.onBack}
            >
              <Ionicons name="close" size={24} color={props.colors.text} />
            </Pressable>
          ),
        }}
      />
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={styles.statusContainer}
      >
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: withAlpha(props.colors.error, 0.125) },
          ]}
        >
          <Ionicons name="alert-circle" size={48} color={props.colors.error} />
        </View>
        <Text style={[styles.statusTitle, { color: props.colors.text }]}>
          Payment Failed
        </Text>
        {props.message ? (
          <Text
            style={[
              styles.statusMessage,
              { color: props.colors.textSecondary },
            ]}
          >
            {props.message}
          </Text>
        ) : null}
        <View style={styles.errorActions}>
          <Pressable
            accessibilityLabel="Try payment again"
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
            onPress={props.onRetry}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: props.colors.border }]}
            onPress={props.onBack}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: props.colors.text },
              ]}
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  invalidTitle: {
    marginTop: SPACING.lg,
  },
  statusMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusLoader: {
    marginTop: SPACING.lg,
  },
  errorActions: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
  },
  primaryButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
  },
  invalidButton: {
    marginTop: SPACING.lg,
  },
  primaryButtonText: {
    color: BRAND.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
