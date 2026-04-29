import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';
import { UTILITY_HISTORY_STYLE_TOKENS } from './history.constants';

export const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  cashbackText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.referenceTextSize,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    gap: UTILITY_HISTORY_STYLE_TOKENS.contentGap,
    paddingHorizontal: SPACING.md,
  },
  errorText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.referenceTextSize,
  },
  paymentNoticeText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.referenceTextSize,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  filterChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: UTILITY_HISTORY_STYLE_TOKENS.chipHorizontalPadding,
    paddingVertical: UTILITY_HISTORY_STYLE_TOKENS.chipVerticalPadding,
  },
  filterChipText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.labelTextSize,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  filterScroller: {
    marginRight: -SPACING.md,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.metaTextSize,
  },
  referenceText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.referenceTextSize,
  },
  pillButtonBase: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: UTILITY_HISTORY_STYLE_TOKENS.touchTargetHeight,
    paddingHorizontal: UTILITY_HISTORY_STYLE_TOKENS.chipHorizontalPadding,
  },
  repeatText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.labelTextSize,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  retryText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.labelTextSize,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  stateCard: {
    alignItems: 'flex-start',
    borderRadius: UTILITY_HISTORY_STYLE_TOKENS.cardRadius,
    borderWidth: 1,
    gap: UTILITY_HISTORY_STYLE_TOKENS.cardGap,
    padding: UTILITY_HISTORY_STYLE_TOKENS.statePadding,
  },
  stateMessage: {
    fontSize: TYPOGRAPHY.size.base,
    lineHeight: UTILITY_HISTORY_STYLE_TOKENS.messageLineHeight,
  },
  stateTitle: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.stateTitleSize,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: UTILITY_HISTORY_STYLE_TOKENS.pillHorizontalPadding,
    paddingVertical: UTILITY_HISTORY_STYLE_TOKENS.pillVerticalPadding,
  },
  statusText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.statusTextSize,
    fontWeight: TYPOGRAPHY.weight.bold,
    textTransform: 'capitalize',
  },
  transactionAmount: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  transactionCard: {
    borderRadius: UTILITY_HISTORY_STYLE_TOKENS.cardRadius,
    borderWidth: 1,
    gap: UTILITY_HISTORY_STYLE_TOKENS.cardGap,
    padding: SPACING.md,
  },
  transactionCopy: {
    flex: 1,
    gap: UTILITY_HISTORY_STYLE_TOKENS.smallGap,
  },
  transactionDetail: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.detailTextSize,
  },
  transactionHeader: {
    flexDirection: 'row',
    gap: UTILITY_HISTORY_STYLE_TOKENS.contentGap,
  },
  transactionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  tokenButton: {
    marginTop: SPACING.sm,
  },
  tokenButtonText: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.labelTextSize,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  voucherBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  voucherCode: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    letterSpacing: 0,
  },
  voucherLabel: {
    fontSize: UTILITY_HISTORY_STYLE_TOKENS.statusTextSize,
    fontWeight: TYPOGRAPHY.weight.semibold,
    marginBottom: UTILITY_HISTORY_STYLE_TOKENS.smallGap,
    textTransform: 'uppercase',
  },
});
