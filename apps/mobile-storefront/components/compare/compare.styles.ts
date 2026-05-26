import { StyleSheet } from 'react-native';
import Colors, { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const compareStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clearButton: {
    marginRight: SPACING.md,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  comparisonTable: {
    gap: 1,
  },
  productRow: {
    flexDirection: 'row',
    gap: 1,
    marginBottom: SPACING.sm,
  },
  specRow: {
    flexDirection: 'row',
    gap: 1,
  },
  labelCell: {
    width: 100,
    padding: SPACING.sm,
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productCell: {
    width: 140,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  productImage: {
    width: 140 - SPACING.md * 2,
    height: 140 - SPACING.md * 2,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  productBrand: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  specCell: {
    width: 140,
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  specValue: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparePriceText: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCell: {
    width: 140,
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  addToCartText: {
    color: Colors.light.white,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  browseButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
  },
  browseButtonText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
