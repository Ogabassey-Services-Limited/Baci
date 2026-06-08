import { StyleSheet } from 'react-native';
import {
  BRAND,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  withAlpha,
} from '@/constants/Colors';
import { WALLET_COLORS } from './wallet.colors';

export const walletSavingsProgressModalStyles = StyleSheet.create({
  backdrop: {
    backgroundColor: withAlpha(WALLET_COLORS.darkText, 0.42),
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  iconButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  contentRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  devicePane: {
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    minHeight: 190,
    width: 118,
  },
  deviceImage: {
    height: 170,
    width: 100,
  },
  devicePlaceholder: {
    alignItems: 'center',
    height: 170,
    justifyContent: 'center',
    width: 100,
  },
  progressPane: {
    flex: 1,
  },
  milestoneRow: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  goalTitle: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  milestoneText: {
    color: WALLET_COLORS.savingsAccent,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  progressTrack: {
    backgroundColor: WALLET_COLORS.progressTrack,
    borderRadius: RADIUS.full,
    height: 38,
    overflow: 'hidden',
  },
  progressFill: {
    alignItems: 'flex-end',
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.full,
    height: '100%',
    justifyContent: 'center',
    minWidth: 42,
    paddingRight: SPACING.sm,
  },
  progressPercent: {
    color: WALLET_COLORS.white,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  amountRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  amountLeft: {
    color: BRAND.primary,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  walletBalance: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  metaPill: {
    backgroundColor: WALLET_COLORS.progressTrack,
    borderRadius: RADIUS.full,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  addSection: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  amountInput: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.base,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.lg,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: WALLET_COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  disabledButton: {
    opacity: 0.65,
  },
  autoDebitHint: {
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: 18,
    marginTop: SPACING.md,
  },
});
