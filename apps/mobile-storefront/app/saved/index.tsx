/**
 * Saved Items (Wishlist) Screen
 * Displays user's saved/favorited products
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { useCartStore } from '@/stores/cart-store';
import { type SavedItem, useSavedStore } from '@/stores/saved-store';
import { formatPrice, getDiscountPercentage } from '@/types/product';

export default function SavedItemsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const items = useSavedStore((state) => state.items);
  const removeItem = useSavedStore((state) => state.removeItem);
  const clearSaved = useSavedStore((state) => state.clearSaved);
  const addToCart = useCartStore((state) => state.addItem);
  const flashListRef = useRef<FlashListRef<SavedItem>>(null);

  const handleRemove = (item: SavedItem) => {
    Alert.alert('Remove Item', `Remove "${item.name}" from saved items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          flashListRef.current?.prepareForLayoutAnimationRender();
          removeItem(item.product_id);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Saved Items',
      'Are you sure you want to remove all saved items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            flashListRef.current?.prepareForLayoutAnimationRender();
            clearSaved();
          },
        },
      ]
    );
  };

  const handleAddToCart = (item: SavedItem) => {
    addToCart({
      product_id: item.product_id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      compare_at_price: item.compare_at_price,
      quantity: 1,
      image_url: item.image,
      condition: item.condition,
    });
    Alert.alert('Added to Cart', `${item.name} has been added to your cart`);
  };

  const handleProductPress = (item: SavedItem) => {
    if (!item.slug) return;
    router.push(`/product/${item.slug}`);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderSavedItem = ({ item }: { item: SavedItem }) => {
    const discountPercentage = getDiscountPercentage(
      item.price,
      item.compare_at_price
    );

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        layout={Layout.springify()}
        style={[styles.itemCard, { backgroundColor: colors.card }]}
      >
        <Pressable
          onPress={() => handleProductPress(item)}
          style={styles.itemContent}
        >
          {/* Product Image */}
          <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              contentFit="cover"
              placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
              transition={200}
              cachePolicy="memory-disk"
            />
            {discountPercentage && (
              <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.discountText, { color: colors.primaryForeground }]}>-{discountPercentage}%</Text>
              </View>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.infoContainer}>
            {item.brand && (
              <Text style={[styles.brandText, { color: colors.textSecondary }]}>
                {item.brand}
              </Text>
            )}
            <Text
              style={[styles.nameText, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <View style={styles.priceRow}>
              <Text style={[styles.priceText, { color: colors.price }]}>
                {formatPrice(item.price)}
              </Text>
              {item.compare_at_price && (
                <Text
                  style={[
                    styles.comparePriceText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {formatPrice(item.compare_at_price)}
                </Text>
              )}
            </View>

            <Text
              style={[styles.savedDateText, { color: colors.textSecondary }]}
            >
              Saved {formatDate(item.savedAt)}
            </Text>
          </View>
        </Pressable>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[
              styles.actionButton,
              styles.removeButton,
              { borderColor: colors.border },
            ]}
            onPress={() => handleRemove(item)}
          >
            <Ionicons
              name="heart-dislike-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.actionButtonText, { color: colors.textSecondary }]}
            >
              Remove
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionButton,
              styles.cartButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="cart-outline" size={18} color="#FFF" />
            <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>
              Add to Cart
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={80} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No saved items
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Tap the heart icon on products to save them for later
      </Text>
      <Pressable
        style={[styles.shopButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/')}
      >
        <Text style={[styles.shopButtonText, { color: colors.primaryForeground }]}>Browse Products</Text>
      </Pressable>
    </View>
  );

  const renderHeader = () => {
    if (items.length === 0) return null;

    return (
      <View style={styles.listHeader}>
        <Text style={[styles.itemCountText, { color: colors.textSecondary }]}>
          {items.length} {items.length === 1 ? 'item' : 'items'} saved
        </Text>
        <Pressable onPress={handleClearAll}>
          <Text style={[styles.clearAllText, { color: colors.primary }]}>
            Clear All
          </Text>
        </Pressable>
      </View>
    );
  };

  // Approximate height of saved item card:
  // padding SPACING.md (16) * 2 = 32
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Saved Items',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <FlashList
        ref={flashListRef}
        data={items}
        renderItem={renderSavedItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.emptyListContent,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  cartButton: {},
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
