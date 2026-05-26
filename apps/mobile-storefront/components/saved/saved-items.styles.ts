import { StyleSheet } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.md,
  },
  emptyListContent: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  itemCountText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: SPACING.md,
  },
  itemCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  itemContent: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparePriceText: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  savedDateText: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  removeButton: {
    borderWidth: 1,
  },
  actionButtonText: {
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
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
