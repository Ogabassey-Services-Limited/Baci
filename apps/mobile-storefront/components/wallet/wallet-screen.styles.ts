import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';

const ACTION_FONT_SIZE = 15;
const BALANCE_DIVIDER_COLOR = 'rgba(255,255,255,0.2)';
const BALANCE_TEXT_COLOR = 'rgba(255,255,255,0.8)';
const COMPACT_PADDING_X = 10;
const COMPACT_PADDING_Y = 6;
const CONTROL_GAP = 6;
const FIELD_PADDING_Y = 14;
const ICON_SIZE = 40;
const PANEL_GAP = 12;
const PANEL_PADDING = 20;
const SCREEN_GAP = 12;
const SMALL_BUTTON_PADDING_Y = 10;
const TIGHT_MARGIN = 2;
const WHITE = '#FFFFFF';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
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
  balanceLabel: {
    color: BALANCE_TEXT_COLOR,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
  balanceAmount: {
    color: WHITE,
    fontSize: TYPOGRAPHY.size['4xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    marginTop: SPACING.sm,
  },
  balanceActions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: BALANCE_DIVIDER_COLOR,
  },
  balanceAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  balanceActionText: {
    color: WHITE,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  divider: {
    width: 1,
    backgroundColor: BALANCE_DIVIDER_COLOR,
  },
  loyaltyCard: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS['2xl'],
    padding: PANEL_PADDING,
    borderWidth: 1,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loyaltyLabel: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
  loyaltyPoints: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    marginTop: SPACING.xs,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: COMPACT_PADDING_X,
    paddingVertical: COMPACT_PADDING_Y,
    borderRadius: RADIUS.full,
  },
  tierText: {
    color: WHITE,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  redeemSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  redeemInfo: {
    fontSize: TYPOGRAPHY.size.sm,
    flex: 1,
  },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CONTROL_GAP,
    paddingHorizontal: SPACING.md,
    paddingVertical: SMALL_BUTTON_PADDING_Y,
    borderRadius: RADIUS.lg,
  },
  redeemBtnText: {
    color: WHITE,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
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
    color: WHITE,
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
    marginTop: SCREEN_GAP,
    fontSize: TYPOGRAPHY.size.base,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: FIELD_PADDING_Y,
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
    marginLeft: SCREEN_GAP,
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
