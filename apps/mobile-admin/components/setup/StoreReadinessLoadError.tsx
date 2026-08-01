import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface StoreReadinessLoadErrorProps {
  isRetrying: boolean;
  onRetry: () => void;
}

export function StoreReadinessLoadError({
  isRetrying,
  onRetry,
}: StoreReadinessLoadErrorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.card }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.message, { color: colors.text }]}>
        Unable to load store setup right now.
      </Text>
      <Pressable
        style={[
          styles.retryButton,
          { backgroundColor: colors.error },
          isRetrying && styles.retryButtonDisabled,
        ]}
        onPress={onRetry}
        disabled={isRetrying}
        accessibilityLabel="Retry loading store setup"
        accessibilityRole="button"
        accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
      >
        {isRetrying ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    gap: SPACING.md,
    margin: SPACING.lg,
    padding: SPACING.lg,
  },
  message: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: SPACING.lg,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
