import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  cancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  container: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
  },
  heroCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  heroValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    marginTop: SPACING.xs,
  },
  input: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  itemMeta: {
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.sm,
  },
  itemMetaValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  itemName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  itemRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
  },
  itemRowDisabled: {
    opacity: 0.45,
  },
  modalActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  modalCard: {
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
  },
  orderAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  orderCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  orderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  orderSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  orderTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  actionButton: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  actionButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  stateContainer: {
    alignItems: 'center',
    gap: SPACING.md,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  stateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flex: 1,
    padding: SPACING.md,
  },
  summaryLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  summaryValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
    marginTop: SPACING.xs,
  },
});
