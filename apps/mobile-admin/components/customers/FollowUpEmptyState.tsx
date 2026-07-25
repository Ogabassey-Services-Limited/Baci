import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface FollowUpEmptyStateProps {
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

/**
 * Empty state for the Customers > Follow Up list.
 *
 * A failed query must never render as "No issues" — a merchant reading that
 * would believe every recent transaction settled while follow-ups pile up
 * unseen. Errors get their own state with a retry affordance.
 */
export function FollowUpEmptyState({
  isError,
  isRetrying,
  onRetry,
}: FollowUpEmptyStateProps) {
  const { colors } = useTheme();

  if (isError) {
    return (
      <View style={styles.container}>
        <Ionicons name="cloud-offline-outline" size={56} color={colors.error} />
        <Text style={[styles.title, { color: colors.text }]}>
          Couldn't load follow-ups
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We couldn't check for unsuccessful transactions. This does not mean
          there are none.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: colors.primaryLight },
            isRetrying && styles.retryButtonDisabled,
            pressed && !isRetrying && { opacity: 0.7 },
          ]}
          onPress={onRetry}
          disabled={isRetrying}
          accessibilityLabel="Retry loading follow-ups"
          accessibilityRole="button"
          accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
        >
          <Text style={[styles.retryLabel, { color: colors.primary }]}>
            {isRetrying ? 'Retrying…' : 'Try again'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons
        name="checkmark-circle-outline"
        size={56}
        color={colors.success}
      />
      <Text style={[styles.title, { color: colors.text }]}>No issues</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        All recent transactions are successful!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginTop: SPACING.md,
  },
  body: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
