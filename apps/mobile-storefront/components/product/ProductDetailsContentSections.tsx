import { Text, View } from 'react-native';
import { ReviewsList } from '@/components/product/ReviewsList';
import { HTMLRenderer } from '@/components/ui/HTMLRenderer';
import type Colors from '@/constants/Colors';
import type { Review, ReviewStats } from '@/hooks/use-reviews';
import type { Product } from '@/types/product';
import { productDetailsBodyStyles as styles } from './ProductDetailsBody.styles';

type ColorsScheme = (typeof Colors)['light'];

interface ProductDetailsContentSectionsProps {
  colors: ColorsScheme;
  hasMoreReviews: boolean;
  loadMoreReviews: () => Promise<void>;
  onMarkHelpful: (reviewId: string) => void;
  product: Product;
  reviews: Review[];
  reviewStats: ReviewStats | null;
  reviewsLoading: boolean;
}

export function ProductDetailsContentSections({
  colors,
  hasMoreReviews,
  loadMoreReviews,
  onMarkHelpful,
  product,
  reviews,
  reviewStats,
  reviewsLoading,
}: ProductDetailsContentSectionsProps) {
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Description
        </Text>
        {product.description ? (
          <HTMLRenderer html={product.description} />
        ) : (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            No description available for this product.
          </Text>
        )}
      </View>

      {product.specifications &&
        Object.keys(product.specifications).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Specifications
            </Text>
            <View style={[styles.specsTable, { borderColor: colors.border }]}>
              {Object.entries(product.specifications).map(([key, val], i) => (
                <View
                  key={key}
                  style={[
                    styles.specRow,
                    i !== 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.specKey, { color: colors.textSecondary }]}
                  >
                    {key}
                  </Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>
                    {val as string}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Customer Reviews
        </Text>
        <ReviewsList
          reviews={reviews}
          stats={reviewStats}
          isLoading={reviewsLoading}
          hasMore={hasMoreReviews}
          onLoadMore={loadMoreReviews}
          onMarkHelpful={onMarkHelpful}
        />
      </View>
    </>
  );
}
