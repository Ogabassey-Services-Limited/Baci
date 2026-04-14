import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  searchContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
    margin: SPACING.md,
    padding: SPACING.md,
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.lg,
    paddingVertical: SPACING.sm,
  },
  loadingState: {
    padding: SPACING['3xl'],
  },
  loadingText: {
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
  resultsContent: {
    flexGrow: 1,
    padding: SPACING.md,
  },
  emptyStateText: {
    marginTop: 40,
    textAlign: 'center',
  },
  resultCard: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  resultInfo: {
    flex: 1,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  domainName: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  popularBadge: {
    borderRadius: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  popularBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xs,
  },
  availabilityText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    marginBottom: SPACING.sm,
  },
  buyButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: SPACING.xs,
    minWidth: 70,
    paddingHorizontal: 16,
    paddingVertical: SPACING.sm,
  },
  buyButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buyText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
