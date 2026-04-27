import { StyleSheet } from 'react-native';
import { WALLET_TAB_TYPOGRAPHY } from '@/components/wallet/wallet-tab.typography';
import { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

const { fontFamily, size } = WALLET_TAB_TYPOGRAPHY;

export const walletTabStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: size.headerTitle,
    fontFamily: fontFamily.bold,
  },
  historyButton: {
    padding: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  balanceCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    ...SHADOWS.lg,
  },
  balanceLabel: {
    fontSize: size.body,
    fontFamily: fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  balanceAmount: {
    fontSize: size.balanceAmount,
    fontFamily: fontFamily.bold,
    marginBottom: SPACING.lg,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  balanceActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  balanceActionText: {
    fontSize: size.body,
    fontFamily: fontFamily.medium,
  },
  pointsCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pointsLabel: {
    fontSize: size.body,
    fontFamily: fontFamily.semiBold,
  },
  pointsAmount: {
    fontSize: size.pointsAmount,
    fontFamily: fontFamily.bold,
    marginBottom: SPACING.md,
  },
  redeemButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  redeemButtonText: {
    fontSize: size.body,
    fontFamily: fontFamily.bold,
  },
  quickActionsSection: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: size.sectionTitle,
    fontFamily: fontFamily.bold,
    marginBottom: SPACING.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  quickAction: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  quickActionLabel: {
    fontSize: size.actionLabel,
    fontFamily: fontFamily.semiBold,
  },
});
