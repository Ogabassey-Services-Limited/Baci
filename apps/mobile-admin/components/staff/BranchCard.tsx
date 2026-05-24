import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { Branch, StaffColors } from './types';

interface BranchCardProps extends StaffColors {
  branch: Branch;
  canDeactivate: boolean;
  onDeactivate: (branchId: string) => void;
  onEdit: (branchId: string) => void;
}

export function BranchCard({
  branch,
  canDeactivate,
  colors,
  shadows,
  onDeactivate,
  onEdit,
}: BranchCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View
            style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}
          >
            <Ionicons name="location" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {branch.name}
              {branch.is_default && ' \u2b50'}
            </Text>
            <Text
              style={[styles.cardSubtitle, { color: colors.textSecondary }]}
            >
              {branch.city || branch.address || 'No address'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: branch.active
                ? colors.successLight
                : colors.cardHover,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: branch.active ? colors.success : colors.textMuted,
              },
            ]}
          >
            {branch.active ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.cardHover }]}
          onPress={() => onEdit(branch.id)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${branch.name}`}
          accessibilityHint={`Opens edit dialog for ${branch.name}`}
        >
          <Ionicons name="create-outline" size={17} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>Edit</Text>
        </Pressable>
        {branch.active ? (
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: colors.cardHover },
              !canDeactivate && styles.actionButtonDisabled,
            ]}
            onPress={() => onDeactivate(branch.id)}
            disabled={!canDeactivate}
            accessibilityRole="button"
            accessibilityLabel={`Deactivate ${branch.name}`}
            accessibilityHint={
              canDeactivate
                ? 'Double tap to deactivate this branch'
                : 'Cannot deactivate the last active branch'
            }
            accessibilityState={{ disabled: !canDeactivate }}
          >
            <Ionicons
              name="ban-outline"
              size={17}
              color={canDeactivate ? colors.notification : colors.textMuted}
            />
            <Text
              style={[
                styles.actionText,
                {
                  color: canDeactivate ? colors.notification : colors.textMuted,
                },
              ]}
            >
              Deactivate
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
