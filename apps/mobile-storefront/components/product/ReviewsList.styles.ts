import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const reviewsListStyles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 14,
  },
  summaryCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  summaryLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
  },
  averageRating: {
    fontSize: 36,
    fontWeight: '800',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginTop: SPACING.xs,
  },
  totalReviews: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  summaryRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingLabel: {
    fontSize: 12,
    width: 12,
    textAlign: 'right',
  },
  ratingBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  ratingCount: {
    fontSize: 11,
    width: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  reviewCard: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  reviewDate: {
    fontSize: 12,
  },
  reviewRating: {
    marginTop: SPACING.sm,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  reviewBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  helpfulText: {
    fontSize: 13,
  },
  loadMoreButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
