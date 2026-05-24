import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import type { Review, ReviewStats } from '@/hooks/use-reviews';

interface ReviewsListProps {
  reviews: Review[];
  stats: ReviewStats | null;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMarkHelpful?: (reviewId: string) => void;
}

export function ReviewsList({
  reviews,
  stats,
  isLoading,
  hasMore,
  onLoadMore,
  onMarkHelpful,
}: ReviewsListProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number, size = 14) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? colors.rating : colors.border}
        />
      ))}
    </View>
  );

  const renderRatingBar = (rating: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;

    return (
      <View style={styles.ratingBarRow} key={rating}>
        <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
          {rating}
        </Text>
        <Ionicons name="star" size={12} color={colors.rating} />
        <View style={[styles.ratingBarBg, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.ratingBarFill,
              { width: `${percentage}%`, backgroundColor: colors.rating },
            ]}
          />
        </View>
        <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>
          {count}
        </Text>
      </View>
    );
  };

  if (isLoading && reviews.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={BRAND.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading reviews...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Rating Summary */}
      {stats && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.summaryLeft}>
            <Text style={[styles.averageRating, { color: colors.text }]}>
              {typeof stats.average_rating === 'number' &&
              Number.isFinite(stats.average_rating)
                ? stats.average_rating.toFixed(1)
                : '0.0'}
            </Text>
            {renderStars(
              Math.round(
                typeof stats.average_rating === 'number' &&
                Number.isFinite(stats.average_rating)
                  ? stats.average_rating
                  : 0
              ),
              18
            )}
            <Text
              style={[styles.totalReviews, { color: colors.textSecondary }]}
            >
              {stats.review_count}{' '}
              {stats.review_count === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            {[5, 4, 3, 2, 1].map((rating) =>
              renderRatingBar(
                rating,
                stats.rating_distribution?.[String(rating)] || 0,
                stats.review_count || 0
              )
            )}
          </View>
        </View>
      )}

      {/* Empty State */}
      {reviews.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Ionicons
            name="chatbubble-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No reviews yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Be the first to review this product
          </Text>
        </View>
      )}

      {/* Reviews List */}
      {reviews.map((review) => (
        <View
          key={review.id}
          style={[styles.reviewCard, { borderColor: colors.border }]}
        >
          <View style={styles.reviewHeader}>
            <View style={styles.reviewerInfo}>
              <View
                style={[styles.avatar, { backgroundColor: BRAND.primaryLight }]}
              >
                <Text style={[styles.avatarText, { color: BRAND.primary }]}>
                  {review.customer_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={[styles.reviewerName, { color: colors.text }]}>
                  {review.customer_name}
                </Text>
                {review.verified_purchase && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#10B981"
                    />
                    <Text style={styles.verifiedText}>Verified Purchase</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
              {formatDate(review.created_at)}
            </Text>
          </View>

          <View style={styles.reviewRating}>{renderStars(review.rating)}</View>

          {review.title && (
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              {review.title}
            </Text>
          )}

          {review.body && (
            <Text style={[styles.reviewBody, { color: colors.textSecondary }]}>
              {review.body}
            </Text>
          )}

          <Pressable
            style={styles.helpfulButton}
            onPress={() => onMarkHelpful?.(review.id)}
          >
            <Ionicons
              name="thumbs-up-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.helpfulText, { color: colors.textSecondary }]}>
              Helpful ({review.helpful_count})
            </Text>
          </Pressable>
        </View>
      ))}

      {/* Load More Button */}
      {hasMore && reviews.length > 0 && (
        <Pressable
          style={[styles.loadMoreButton, { borderColor: colors.border }]}
          onPress={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={BRAND.primary} />
          ) : (
            <Text style={[styles.loadMoreText, { color: BRAND.primary }]}>
              Load More Reviews
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
