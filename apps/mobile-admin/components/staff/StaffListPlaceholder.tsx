import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface StaffListPlaceholderProps {
  message?: string;
  mode: 'empty' | 'error' | 'loading';
  onInvite: () => void;
  onRetry: () => void;
}

export function StaffListPlaceholder({
  message,
  mode,
  onInvite,
  onRetry,
}: StaffListPlaceholderProps) {
  const { colors } = useTheme();

  if (mode === 'loading') {
    return (
      <View accessibilityRole="progressbar" style={styles.emptyContainer}>
        <ActivityIndicator color={colors.textMuted} size="large" />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Loading team members...
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Checking your current staff list
        </Text>
      </View>
    );
  }

  if (mode === 'error') {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Unable to load team members.
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {message || 'Try again to refresh your staff list.'}
        </Text>
        <Pressable
          accessibilityLabel="Retry loading team members"
          accessibilityRole="button"
          style={[styles.emptyButton, { backgroundColor: colors.primary }]}
          onPress={onRetry}
        >
          <Ionicons name="refresh" size={18} color={colors.textOnPrimary} />
          <Text
            style={[styles.emptyButtonText, { color: colors.textOnPrimary }]}
          >
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No team members yet
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Invite staff to help manage your store
      </Text>
      <Pressable
        accessibilityLabel="Invite team member"
        accessibilityRole="button"
        style={[styles.emptyButton, { backgroundColor: colors.primary }]}
        onPress={onInvite}
      >
        <Ionicons name="person-add" size={18} color={colors.textOnPrimary} />
        <Text style={[styles.emptyButtonText, { color: colors.textOnPrimary }]}>
          Invite Team Member
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  emptyButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
