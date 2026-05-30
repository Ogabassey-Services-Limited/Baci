import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';
import { WALLET_COLORS } from './wallet.colors';
import { walletHeroStyles } from './wallet-hero.styles';

const ACTION_FONT_SIZE = 15;
const FIELD_PADDING_Y = 14;
const ICON_SIZE = 40;
const PANEL_GAP = 12;
const PANEL_PADDING = 20;
const TIGHT_MARGIN = 2;

export const styles = StyleSheet.create({
  ...walletHeroStyles,
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  tabHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  tabHeaderTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  balanceCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS['3xl'],
    padding: SPACING.lg,
  },
  redeemPanel: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS['2xl'],
    padding: PANEL_PADDING,
    borderWidth: 1,
  },
  redeemPanelTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    marginBottom: SPACING.xs,
  },
  redeemPanelSubtitle: {
    fontSize: TYPOGRAPHY.size.base,
    marginBottom: SPACING.md,
  },
  redeemInput: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: FIELD_PADDING_Y,
    fontSize: TYPOGRAPHY.size.lg,
    marginBottom: SPACING.md,
  },
  redeemPanelActions: {
    flexDirection: 'row',
    gap: PANEL_GAP,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: FIELD_PADDING_Y,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: ACTION_FONT_SIZE,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: FIELD_PADDING_Y,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: WALLET_COLORS.white,
    fontSize: ACTION_FONT_SIZE,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  historySection: {
    margin: SPACING.md,
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    marginBottom: SPACING.md,
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    marginTop: 12,
    fontSize: TYPOGRAPHY.size.base,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  txIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txDetails: {
    flex: 1,
    marginLeft: 12,
  },
  txDescription: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
  txDate: {
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: TIGHT_MARGIN,
  },
  txAmount: {
    fontSize: ACTION_FONT_SIZE,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
});
