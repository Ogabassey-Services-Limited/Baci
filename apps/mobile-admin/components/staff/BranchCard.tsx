/**
 * BranchCard
 * Renders a single branch location card
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { Branch, StaffColors } from './types';

interface BranchCardProps extends StaffColors {
  branch: Branch;
}

export function BranchCard({ branch, colors, shadows }: BranchCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View
            style={[
              styles.cardIcon,
              { backgroundColor: colors.primaryLight || '#E8F0FE' },
            ]}
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
                ? colors.successLight || '#E8F5E9'
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
});
