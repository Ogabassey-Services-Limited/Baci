import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const BADGE_GAP = 4;
const BADGE_HORIZONTAL_PADDING = 6;
const BADGE_VERTICAL_PADDING = 2;

export const styles = StyleSheet.create({
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
  badge: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    gap: BADGE_GAP,
    paddingHorizontal: BADGE_HORIZONTAL_PADDING,
    paddingVertical: BADGE_VERTICAL_PADDING,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.xs,
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
  emptyContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
    marginTop: SPACING.md,
  },
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
  staffEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: 6,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
