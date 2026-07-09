import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';

export const productVariantsCardStyles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  bulkButton: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
  },
  bulkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  conditionNote: {
    fontSize: 12,
    marginTop: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  halfInput: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    marginRight: SPACING.md,
  },
  helpBox: {
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    padding: SPACING.md,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  showingText: {
    fontSize: 12,
    marginTop: SPACING.sm,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  variantList: {
    marginTop: SPACING.xs,
  },
});
