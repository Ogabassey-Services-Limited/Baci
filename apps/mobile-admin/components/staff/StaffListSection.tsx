import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import {
  Pressable,
  RefreshControl,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { ROLE_LABELS, type StaffMember } from '@/lib/types/staff';

const BADGE_GAP = 4;
const BADGE_HORIZONTAL_PADDING = 6;
const BADGE_VERTICAL_PADDING = 2;
const EMPTY_EMAIL_LABEL = 'Email unavailable';

interface StaffListSectionProps {
  colors: ThemeColors;
  isLoading: boolean;
  onInvitePress: () => void;
  onMemberPress: (member: StaffMember) => void;
  onRefresh: () => void;
  refreshing: boolean;
  shadowStyle: StyleProp<ViewStyle>;
  staff: StaffMember[] | undefined;
}

export function StaffListSection({
  colors,
  isLoading,
  onInvitePress,
  onMemberPress,
  onRefresh,
  refreshing,
  shadowStyle,
  staff,
}: StaffListSectionProps) {
  const getStatusBadge = (status: StaffMember['status']) => {
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
        return {
          bg: colors.border,
          icon: 'help-circle',
          label: status,
          text: colors.textMuted,
        };
    }
  };

  return (
    <FlashList
      contentContainerStyle={styles.listContent}
      data={staff}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        isLoading ? (
          <View accessibilityRole="progressbar" style={styles.emptyContainer}>
            <Ionicons
              name="reload-outline"
              size={40}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading team members...
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Checking your current staff list
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={56}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No team members yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Invite staff to help manage your store
            </Text>
            <Pressable
              accessibilityLabel="Invite team member"
              accessibilityRole="button"
              onPress={onInvitePress}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons
                name="person-add"
                size={18}
                color={colors.textOnPrimary}
              />
              <Text
                style={[
                  styles.emptyButtonText,
                  { color: colors.textOnPrimary },
                ]}
              >
                Invite Team Member
              </Text>
            </Pressable>
          </View>
        )
      }
      refreshControl={
        <RefreshControl
          colors={[colors.gold]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={colors.gold}
        />
      }
      renderItem={({ item }) => {
        const statusBadge = getStatusBadge(item.status);
        const emailPrefix = item.email?.trim()
          ? item.email.split('@')[0]
          : undefined;
        const displayName = item.name?.trim() || emailPrefix || 'Unknown User';
        const displayEmail = item.email?.trim() || EMPTY_EMAIL_LABEL;
        const roleLabel = ROLE_LABELS[item.role] ?? 'Unknown';

        return (
          <Pressable
            accessibilityLabel={`Team member ${displayName}`}
            accessibilityRole="button"
            onPress={() => onMemberPress(item)}
            style={({ pressed }) => [
              styles.staffCard,
              { backgroundColor: pressed ? colors.cardHover : colors.card },
              shadowStyle,
            ]}
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor:
                    colors.primaryLight ??
                    colors.cardHover ??
                    colors.background,
                },
              ]}
            >
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
                    color: item.email?.trim()
                      ? colors.textSecondary
                      : colors.textMuted,
                  },
                ]}
              >
                {displayEmail}
              </Text>

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.goldLight },
                  ]}
                >
                  <Ionicons
                    name="shield-outline"
                    size={10}
                    color={colors.gold}
                  />
                  <Text style={[styles.badgeText, { color: colors.gold }]}>
                    {roleLabel}
                  </Text>
                </View>

                <View
                  style={[
                    styles.badge,
                    { backgroundColor: statusBadge.bg },
                  ]}
                >
                  <Ionicons
                    color={statusBadge.text}
                    name={statusBadge.icon as keyof typeof Ionicons.glyphMap}
                    size={10}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: statusBadge.text },
                    ]}
                  >
                    {statusBadge.label}
                  </Text>
                </View>
              </View>
            </View>

            <Ionicons
              color={colors.textMuted}
              name="chevron-forward"
              size={18}
            />
          </Pressable>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 0,
  },
  staffCard: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    padding: SPACING.md,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 48,
    justifyContent: 'center',
    marginRight: SPACING.md,
    width: 48,
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  staffEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  badge: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    gap: BADGE_GAP,
    paddingHorizontal: BADGE_HORIZONTAL_PADDING,
    paddingVertical: BADGE_VERTICAL_PADDING,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  emptyButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  emptyButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
