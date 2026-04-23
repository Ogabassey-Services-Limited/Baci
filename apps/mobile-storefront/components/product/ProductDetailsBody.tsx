/**
 * ProductDetailsBody - The animated content card below the image gallery.
 * Contains meta info, pricing, negotiation, variant selectors, description,
 * specs, and reviews for the product detail screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ConditionSelector } from '@/components/product/ConditionSelector';
import { ReviewsList } from '@/components/product/ReviewsList';
import { VariantSelector } from '@/components/product/VariantSelector';
import { HTMLRenderer } from '@/components/ui/HTMLRenderer';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, TYPOGRAPHY } from '@/constants/Colors';
import type { Review, ReviewStats } from '@/hooks/use-reviews';
import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import { mergeVariantAttributes } from '@/lib/product-normalization';
import type { Product, ProductCondition } from '@/types/product';
import { formatPrice } from '@/types/product';

type ColorsScheme = (typeof Colors)['light'];

export interface ProductDetailsBodyProps {
  availableConditions: ProductCondition[];
  conditionOffers: NonNullable<Product['offers']>;
  product: Product;
  effectivePrice: number;
  effectiveComparePrice: number | undefined;
  negotiatedPrice: number | null;
  canPurchase: boolean;
  selectedVariant: string | null;
  setSelectedVariant: (id: string) => void;
  selectedCondition: ProductCondition | null;
  setSelectedCondition: (c: ProductCondition) => void;
  selectedAttributes: Record<string, string>;
  selectedColor: string | null;
  selectedStorage: string | null;
  onSelectAttribute: (axis: string, value: string) => void;
  onSelectColor: (color: string, imgs?: string[]) => void;
  onSelectStorage: (storage: string) => void;
  onOpenNegotiation: () => void;
  reviews: Review[];
  reviewStats: ReviewStats | null;
  reviewsLoading: boolean;
  hasMoreReviews: boolean;
  loadMoreReviews: () => Promise<void>;
  onMarkHelpful: (reviewId: string) => void;
  colors: ColorsScheme;
}

export function ProductDetailsBody({
  availableConditions,
  conditionOffers,
  product,
  effectivePrice,
  effectiveComparePrice,
  negotiatedPrice,
  selectedVariant,
  setSelectedVariant,
  selectedCondition,
  setSelectedCondition,
  selectedAttributes,
  selectedColor,
  selectedStorage,
  onSelectAttribute,
  onSelectColor,
  onSelectStorage,
  onOpenNegotiation,
  reviews,
  reviewStats,
  reviewsLoading,
  hasMoreReviews,
  loadMoreReviews,
  onMarkHelpful,
  colors,
}: ProductDetailsBodyProps) {
  const mergedVariantAttributes = mergeVariantAttributes(
    product.variant_attributes,
    product.variants
  );
  const showVariantSelector =
    Boolean(product.colors) ||
    Boolean(product.color_images) ||
    Boolean(
      mergedVariantAttributes && Object.keys(mergedVariantAttributes).length > 0
    ) ||
    Boolean(mergedVariantAttributes?.storage) ||
    Boolean(
      product.variants?.some(
        (v) => v.attributes && Object.keys(v.attributes).length > 0
      )
    );
  const hasPriceDrivingVariantAxes =
    Boolean(mergedVariantAttributes?.storage) ||
    Object.keys(mergedVariantAttributes ?? {}).some(
      (axis) => !isInternalSelectionAxis(axis)
    );

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(600)}
      style={[styles.detailsContainer, { backgroundColor: colors.background }]}
    >
      {/* Meta Info */}
      <View style={styles.metaRow}>
        {product.brand && (
          <Text style={[styles.brandText, { color: colors.textSecondary }]}>
            {product.brand}
          </Text>
        )}
        {product.condition && (
          <View
            style={[
              styles.conditionBadge,
              {
                backgroundColor:
                  product.condition === 'New' ? colors.success : colors.warning,
              },
            ]}
          >
            <Text style={styles.conditionText}>{product.condition}</Text>
          </View>
        )}
      </View>

      {/* Title & Rating */}
      <Text style={[styles.title, { color: colors.text }]}>{product.name}</Text>

      <View style={styles.ratingRow}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => {
            const rating = reviewStats?.average_rating ?? product.rating ?? 4.5;
            return (
              <Ionicons
                key={s}
                name={s <= Math.round(rating) ? 'star' : 'star-outline'}
                size={14}
                color={s <= Math.round(rating) ? colors.rating : colors.border}
              />
            );
          })}
        </View>
        <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
          {typeof reviewStats?.average_rating === 'number' &&
          Number.isFinite(reviewStats.average_rating)
            ? `${reviewStats.average_rating.toFixed(1)} (${reviewStats.review_count ?? 0} reviews)`
            : product.rating
              ? `${product.rating} (${product.review_count || 0} reviews)`
              : 'No reviews yet'}
        </Text>
      </View>

      {/* Pricing */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: BRAND.primary }]}>
          {formatPrice(effectivePrice)}
        </Text>
        {effectiveComparePrice && effectiveComparePrice > effectivePrice && (
          <Text style={[styles.comparePrice, { color: colors.textSecondary }]}>
            {formatPrice(effectiveComparePrice)}
          </Text>
        )}
      </View>

      {/* Negotiated Price Badge */}
      {/* M11 FIX: Use != null instead of truthy check so price of 0 is handled */}
      {negotiatedPrice != null && (
        <View style={styles.negotiatedBadge}>
          <Ionicons name="pricetag" size={14} color="#10B981" />
          <Text style={styles.negotiatedText}>Your negotiated price!</Text>
        </View>
      )}

      {/* Make an Offer Button */}
      {negotiatedPrice == null && (
        <Pressable
          style={[styles.makeOfferButton, { borderColor: BRAND.primary }]}
          onPress={onOpenNegotiation}
        >
          <Ionicons name="chatbubble-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.makeOfferText, { color: BRAND.primary }]}>
            Make an Offer
          </Text>
        </Pressable>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Condition Selector */}
      {availableConditions.length > 1 && (
        <ConditionSelector
          currentCondition={product.condition}
          offers={conditionOffers}
          availableConditions={availableConditions}
          selectedCondition={selectedCondition}
          onSelect={setSelectedCondition}
          basePrice={product.price}
          showPrices={!product.has_variants || !hasPriceDrivingVariantAxes}
        />
      )}

      {/* Advanced Variant Selection */}
      {showVariantSelector && (
        <View style={styles.section}>
          <VariantSelector
            attributes={mergedVariantAttributes}
            colors={product.colors}
            colorImages={product.color_images}
            storage={mergedVariantAttributes?.storage}
            variants={product.variants}
            manageStock={product.manage_stock}
            selectedAttributes={selectedAttributes}
            selectedColor={selectedColor}
            selectedStorage={selectedStorage}
            onSelectAttribute={onSelectAttribute}
            onSelectColor={onSelectColor}
            onSelectStorage={onSelectStorage}
          />
        </View>
      )}

      {/* Legacy Variants (fallback for products without colors/storage) */}
      {product.variants &&
        product.variants.length > 0 &&
        !product.colors &&
        !product.color_images &&
        !product.variants.some((v) => v.attributes?.storage) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Options
            </Text>
            <View style={styles.variantGrid}>
              {product.variants.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVariant(v.id)}
                  style={[
                    styles.variantChip,
                    {
                      borderColor:
                        selectedVariant === v.id
                          ? BRAND.primary
                          : colors.border,
                    },
                    selectedVariant === v.id && {
                      backgroundColor: `${BRAND.primary}10`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.variantLabel,
                      {
                        color:
                          selectedVariant === v.id
                            ? BRAND.primary
                            : colors.text,
                      },
                    ]}
                  >
                    {v.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

      {/* Description */}
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

      {/* Specs */}
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

      {/* Reviews Section */}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  detailsContainer: {
    borderTopLeftRadius: RADIUS['3xl'],
    borderTopRightRadius: RADIUS['3xl'],
    marginTop: -RADIUS['3xl'],
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  conditionText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 24,
  },
  price: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: '900',
  },
  comparePrice: {
    fontSize: 18,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  negotiatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  negotiatedText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  makeOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
  },
  makeOfferText: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  variantChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  variantLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  specsTable: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  specKey: {
    fontSize: 14,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
