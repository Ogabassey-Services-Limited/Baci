import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ROLE_LABELS, type StaffMember } from '@/lib/types/staff';

const BADGE_GAP = 4;
const BADGE_HORIZONTAL_PADDING = 6;
const BADGE_VERTICAL_PADDING = 2;
const EMPTY_EMAIL_LABEL = 'Email unavailable';

interface StaffMemberCardProps {
  member: StaffMember;
  onPress: () => void;
}

function getStatusBadge(
  status: StaffMember['status'],
  colors: ReturnType<typeof useTheme>['colors']
) {
  switch (status) {
    case 'active':
      return {
        bg: colors.successLight,
        icon: 'checkmark-circle',
        label: 'Active',
        text: colors.success,
      };
    case 'pending':
      return {
        bg: colors.warningLight,
        icon: 'time',
        label: 'Pending',
        text: colors.warning,
      };
    case 'suspended':
      return {
        bg: colors.errorLight,
        icon: 'close-circle',
        label: 'Suspended',
        text: colors.error,
      };
    default:
      console.warn(`Unexpected status in StaffMemberCard: ${status}`);
      return {
        bg: colors.border,
        icon: 'help-circle',
        label: 'Unknown',
        text: colors.textMuted,
      };
  }
}

export function StaffMemberCard({ member, onPress }: StaffMemberCardProps) {
  const { colors, shadows } = useTheme();
  const statusBadge = getStatusBadge(member.status, colors);
  const roleLabel = ROLE_LABELS[member.role] ?? member.role ?? 'Unknown';
  const emailPrefix = member.email?.trim()
    ? member.email.split('@')[0]
    : undefined;
  const displayName = member.name?.trim() || emailPrefix || 'Unknown User';
  const displayEmail = member.email?.trim() || EMPTY_EMAIL_LABEL;

  return (
    <Pressable
      accessibilityLabel={`Team member ${displayName}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.staffCard,
        { backgroundColor: colors.card },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={onPress}
    >
      <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {displayName.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.staffInfo}>
        <Text style={[styles.staffName, { color: colors.text }]}>
          {displayName}
        </Text>
        <Text
          style={[
            styles.staffEmail,
            {
              color: member.email?.trim()
                ? colors.textSecondary
                : colors.textMuted,
            },
          ]}
        >
          {displayEmail}
        </Text>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.goldLight }]}>
            <Ionicons name="shield-outline" size={10} color={colors.gold} />
            <Text style={[styles.badgeText, { color: colors.gold }]}>
              {roleLabel}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
            <Ionicons
              name={statusBadge.icon as keyof typeof Ionicons.glyphMap}
              size={10}
              color={statusBadge.text}
            />
            <Text style={[styles.badgeText, { color: statusBadge.text }]}>
              {statusBadge.label}
            </Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  staffCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  staffEmail: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BADGE_HORIZONTAL_PADDING,
    paddingVertical: BADGE_VERTICAL_PADDING,
    borderRadius: RADIUS.sm,
    gap: BADGE_GAP,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
