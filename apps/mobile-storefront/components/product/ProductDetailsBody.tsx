/**
 * ProductDetailsBody - The animated content card below the image gallery.
 * Contains meta info, pricing, negotiation, variant selectors, description,
 * specs, and reviews for the product detail screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ConditionSelector } from '@/components/product/ConditionSelector';
import { PricingSection } from '@/components/product/PricingSection';
import styles from '@/components/product/ProductDetailsBody.styles';
import { ReviewsList } from '@/components/product/ReviewsList';
import { SpecsTable } from '@/components/product/SpecsTable';
import { VariantSelector } from '@/components/product/VariantSelector';
import { HTMLRenderer } from '@/components/ui/HTMLRenderer';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import type { Review, ReviewStats } from '@/hooks/use-reviews';
import type { Product, ProductCondition } from '@/types/product';

type ColorsScheme = (typeof Colors)['light'];

export interface ProductDetailsBodyProps {
  product: Product;
  effectivePrice: number;
  effectiveComparePrice: number | undefined;
  negotiatedPrice: number | null;
  selectedVariant: string | null;
  setSelectedVariant: (id: string) => void;
  selectedCondition: ProductCondition | null;
  setSelectedCondition: (c: ProductCondition) => void;
  selectedColor: string | null;
  selectedStorage: string | null;
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
  product,
  effectivePrice,
  effectiveComparePrice,
  negotiatedPrice,
  selectedVariant,
  setSelectedVariant,
  selectedCondition,
  setSelectedCondition,
  selectedColor,
  selectedStorage,
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
            const rating = reviewStats?.average_rating ?? product.rating ?? 0;
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

      {/* Pricing & Negotiation */}
      <PricingSection
        effectivePrice={effectivePrice}
        effectiveComparePrice={effectiveComparePrice}
        negotiatedPrice={negotiatedPrice}
        onOpenNegotiation={onOpenNegotiation}
        colors={colors}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Condition Selector */}
      {product.has_condition_offers && product.offers && (
        <ConditionSelector
          currentCondition={product.condition}
          offers={product.offers}
          selectedCondition={selectedCondition}
          onSelect={setSelectedCondition}
          basePrice={product.price}
        />
      )}

      {/* Advanced Variant Selection */}
      {(product.colors ||
        product.color_images ||
        product.variant_attributes?.storage ||
        product.variants?.some((v) => v.attributes?.storage)) && (
        <View style={styles.section}>
          <VariantSelector
            colors={product.colors}
            colorImages={product.color_images}
            storage={
              product.variant_attributes?.storage ||
              product.variants
                ?.map((v) => v.attributes?.storage)
                .filter((s): s is string => !!s)
            }
            variants={product.variants}
            selectedColor={selectedColor}
            selectedStorage={selectedStorage}
            onSelectColor={onSelectColor}
            onSelectStorage={onSelectStorage}
            basePrice={effectivePrice}
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
            <SpecsTable
              specifications={product.specifications}
              colors={colors}
            />
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
