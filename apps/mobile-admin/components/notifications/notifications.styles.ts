import { StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginTop: SPACING.sm,
  },
  infoSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xl,
  },
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  cardShadow: { marginBottom: SPACING.xl },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  settingInfo: { flex: 1, marginRight: SPACING.md },
  settingLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  settingDesc: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.xs,
  },
  divider: { height: 1, marginHorizontal: SPACING.lg },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  noteText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
});
