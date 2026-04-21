/**
 * Saved Items (Wishlist) Screen
 * Displays user's saved/favorited products
 */

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SavedItemCard } from '@/app/saved/SavedItemCard';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { useCartStore } from '@/stores/cart-store';
import { type SavedItem, useSavedStore } from '@/stores/saved-store';

export default function SavedItemsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { getListContentStyle } = useStorefrontInsets();
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
    if (!item.slug) {
      console.warn('Saved item is missing a product slug', {
        id: item.id,
        name: item.name,
      });
      Alert.alert(
        'Product Unavailable',
        'This saved item is no longer available.'
      );
      return;
    }
    router.push(`/product/${item.slug}`);
  };

  const renderHeader = () => {
    if (items.length === 0) return null;

    return (
      <View style={styles.listHeader}>
        <Text style={[styles.itemCountText, { color: colors.textSecondary }]}>
          {items.length} {items.length === 1 ? 'item' : 'items'} saved
        </Text>
        <Pressable
          onPress={handleClearAll}
          accessibilityRole="button"
          accessibilityLabel="Clear all saved items"
        >
          <Text style={[styles.clearAllText, { color: BRAND.primary }]}>
            Clear All
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No saved items
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Tap the heart icon on products to save them for later
      </Text>
      <Pressable
        style={[styles.shopButton, { backgroundColor: BRAND.primary }]}
        onPress={() => router.push('/')}
        accessibilityRole="button"
        accessibilityLabel="Browse products"
      >
        <Text style={styles.shopButtonText}>Browse Products</Text>
      </Pressable>
    </View>
  );

  return (
    <StorefrontScreenShell
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
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
        renderItem={({ item }) => (
          <SavedItemCard
            colors={colors}
            item={item}
            onAddToCart={handleAddToCart}
            onPress={handleProductPress}
            onRemove={handleRemove}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          getListContentStyle({
            gap: SPACING.md,
            includeBottomInset: false,
            padding: SPACING.md,
            paddingBottom: SPACING.lg,
          }),
          items.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </StorefrontScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyListContent: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCountText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearAllText: {
    fontSize: 14,
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
