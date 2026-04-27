import { StyleSheet } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const walletStyles = StyleSheet.create({
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
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
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
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: SPACING.xs,
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
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
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
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
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  pointsAmount: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
  },
  redeemButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  redeemButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  quickActionsSection: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
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
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
