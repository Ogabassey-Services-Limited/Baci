import { StyleSheet } from 'react-native';
import { palette, RADIUS, SPACING } from '@/constants/Colors';

const ADDRESS_BADGE_VERTICAL_PADDING = 2;
const ADDRESS_MENU_BUTTON_PADDING = 4;
const ADDRESS_ACTION_BUTTON_GAP = 4;
const ADDRESS_ACTION_BUTTON_VERTICAL_PADDING = 6;
const ADDRESS_ACTION_BUTTON_RADIUS = 6;
const ADDRESS_FAB_OFFSET = 24;
const ADDRESS_FAB_SIZE = 56;
const ADDRESS_RETRY_MARGIN_TOP = 8;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyListContent: {
    flex: 1,
  },
  addressCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: ADDRESS_BADGE_VERTICAL_PADDING,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    padding: ADDRESS_MENU_BUTTON_PADDING,
  },
  addressContent: {
    marginBottom: SPACING.md,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '500',
  },
  addressPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  addressLine: {
    fontSize: 14,
    marginTop: 2,
  },
  addressActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ADDRESS_ACTION_BUTTON_GAP,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: ADDRESS_ACTION_BUTTON_VERTICAL_PADDING,
    borderRadius: ADDRESS_ACTION_BUTTON_RADIUS,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
  },
  addButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: ADDRESS_FAB_OFFSET,
    right: ADDRESS_FAB_OFFSET,
    width: ADDRESS_FAB_SIZE,
    height: ADDRESS_FAB_SIZE,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    fontSize: 16,
    marginTop: SPACING.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: ADDRESS_RETRY_MARGIN_TOP,
  },
});
