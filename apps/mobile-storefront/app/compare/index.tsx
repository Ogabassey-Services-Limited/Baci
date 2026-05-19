/**
 * Product Comparison Screen
 * Side-by-side comparison of up to 3 products
 */

import { requiresProductSelection } from '@baci/shared/lib';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { useCartStore } from '@/stores/cart-store';
import { useComparisonStore } from '@/stores/comparison-store';
import { formatPrice } from '@/types/product';

export default function CompareScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const { products, removeProduct, clearComparison } = useComparisonStore(
    useShallow((state) => ({
      products: state.products,
      removeProduct: state.removeProduct,
      clearComparison: state.clearComparison,
    }))
  );
  const addToCart = useCartStore((state) => state.addItem);

  // Collect all unique spec keys across all products
  const allSpecKeys = (() => {
    const keys = new Set<string>();
    for (const product of products) {
      if (product.specifications) {
        for (const key of Object.keys(product.specifications)) {
          keys.add(key);
        }
      }
    }
    return Array.from(keys);
  })();

  const handleAddToCart = (product: (typeof products)[0]) => {
    if (requiresProductSelection(product)) {
      if (product.slug) {
        router.push(`/product/${product.slug}`);
      }
      return;
    }

    addToCart({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      image_url: product.image,
      condition: product.condition,
    });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="git-compare-outline"
        size={80}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No products to compare
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Add products to compare their features and prices
      </Text>
      <Pressable
        style={[styles.browseButton, { backgroundColor: BRAND.primary }]}
        onPress={() => router.push('/')}
      >
        <Text style={styles.browseButtonText}>Browse Products</Text>
      </Pressable>
    </View>
  );

  if (products.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Compare Products',
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
          }}
        />
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: `Compare (${products.length})`,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable onPress={clearComparison} style={styles.clearButton}>
              <Text style={[styles.clearButtonText, { color: BRAND.primary }]}>
                Clear All
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
      >
        <View style={styles.comparisonTable}>
          {/* Product Cards Row */}
          <View style={styles.productRow}>
            <View style={[styles.labelCell, { backgroundColor: colors.card }]}>
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>
                Product
              </Text>
            </View>
            {products.map((product) => (
              <View
                key={product.id}
                style={[styles.productCell, { backgroundColor: colors.card }]}
              >
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeProduct(product.id)}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={colors.textSecondary}
                  />
                </Pressable>

                <Pressable
                  onPress={() => router.push(`/product/${product.slug}`)}
                >
                  <Image
                    source={{
                      uri:
                        product.image ||
                        'https://placehold.co/400x400/1a1a1a/ffffff?text=P',
                    }}
                    style={styles.productImage}
                    contentFit="cover"
                    placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
                  />
                  <Text
                    style={[styles.productName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {product.name}
                  </Text>
                  {product.brand && (
                    <Text
                      style={[
                        styles.productBrand,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {product.brand}
                    </Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>

          {/* Price Row */}
          <View style={styles.specRow}>
            <View
              style={[styles.labelCell, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>
                Price
              </Text>
            </View>
            {products.map((product) => (
              <View
                key={product.id}
                style={[
                  styles.specCell,
                  { backgroundColor: colors.background },
                ]}
              >
                <Text style={[styles.priceText, { color: BRAND.primary }]}>
                  {formatPrice(product.price)}
                </Text>
                {product.compare_at_price &&
                  product.compare_at_price > product.price && (
                    <Text
                      style={[
                        styles.comparePriceText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatPrice(product.compare_at_price)}
                    </Text>
                  )}
              </View>
            ))}
          </View>

          {/* Condition Row */}
          <View style={styles.specRow}>
            <View style={[styles.labelCell, { backgroundColor: colors.card }]}>
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>
                Condition
              </Text>
            </View>
            {products.map((product) => (
              <View
                key={product.id}
                style={[styles.specCell, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.specValue, { color: colors.text }]}>
                  {product.condition || 'New'}
                </Text>
              </View>
            ))}
          </View>

          {/* Rating Row */}
          <View style={styles.specRow}>
            <View
              style={[styles.labelCell, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>
                Rating
              </Text>
            </View>
            {products.map((product) => (
              <View
                key={product.id}
                style={[
                  styles.specCell,
                  { backgroundColor: colors.background },
                ]}
              >
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={colors.rating} />
                  <Text style={[styles.specValue, { color: colors.text }]}>
                    {product.rating?.toFixed(1) || 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Specification Rows */}
          {allSpecKeys.map((specKey, index) => (
            <View key={specKey} style={styles.specRow}>
              <View
                style={[
                  styles.labelCell,
                  {
                    backgroundColor:
                      index % 2 === 0 ? colors.card : colors.background,
                  },
                ]}
              >
                <Text
                  style={[styles.labelText, { color: colors.textSecondary }]}
                >
                  {specKey}
                </Text>
              </View>
              {products.map((product) => (
                <View
                  key={product.id}
                  style={[
                    styles.specCell,
                    {
                      backgroundColor:
                        index % 2 === 0 ? colors.card : colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.specValue, { color: colors.text }]}>
                    {product.specifications?.[specKey] || '-'}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          {/* Add to Cart Row */}
          <View style={styles.specRow}>
            <View style={[styles.labelCell, { backgroundColor: colors.card }]}>
              <Text style={[styles.labelText, { color: colors.textSecondary }]}>
                Action
              </Text>
            </View>
            {products.map((product) => (
              <View
                key={product.id}
                style={[styles.actionCell, { backgroundColor: colors.card }]}
              >
                <Pressable
                  style={[
                    styles.addToCartButton,
                    { backgroundColor: BRAND.primary },
                  ]}
                  onPress={() => handleAddToCart(product)}
                >
                  <Ionicons name="cart-outline" size={16} color="#FFF" />
                  <Text style={styles.addToCartText}>Add</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const CELL_WIDTH = 140;
const LABEL_WIDTH = 100;

const styles = StyleSheet.create({
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
    width: LABEL_WIDTH,
    padding: SPACING.sm,
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productCell: {
    width: CELL_WIDTH,
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
    width: CELL_WIDTH - SPACING.md * 2,
    height: CELL_WIDTH - SPACING.md * 2,
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
    width: CELL_WIDTH,
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
    width: CELL_WIDTH,
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
    color: '#FFF',
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
