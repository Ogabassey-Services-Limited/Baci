import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface VerificationStatusBadgeProps {
  label?: string;
  status: 'not-started' | 'pending' | 'verified';
}

export default function VerificationStatusBadge({
  label,
  status,
}: VerificationStatusBadgeProps) {
  const { colors } = useTheme();
  const isPending = status === 'pending';
  const isVerified = status === 'verified';
  const resolvedLabel =
    label ?? (isVerified ? 'Verified' : isPending ? 'Pending' : 'Not Started');
  const backgroundColor = isVerified
    ? colors.successLight
    : isPending
      ? colors.warningLight
      : colors.inputBg;
  const textColor = isVerified
    ? colors.success
    : isPending
      ? colors.warning
      : colors.textMuted;

  return (
    <View
      style={[styles.badge, { backgroundColor }]}
      accessibilityRole="text"
      accessibilityLabel={resolvedLabel}
    >
      {isVerified ? (
        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
      ) : isPending ? (
        <Ionicons name="time-outline" size={14} color={colors.warning} />
      ) : null}
      <Text style={[styles.label, { color: textColor }]}>{resolvedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.xs,
  },
});
