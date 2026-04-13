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
    fontSize: 16,
    paddingVertical: 8,
  },
  loadingState: {
    padding: 40,
  },
  loadingText: {
    marginTop: 20,
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
    gap: 8,
  },
  domainName: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: 16,
  },
  popularBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  availabilityText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 13,
    marginTop: 4,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 16,
    marginBottom: 8,
  },
  buyButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: 6,
    minWidth: 70,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buyText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 12,
  },
});
