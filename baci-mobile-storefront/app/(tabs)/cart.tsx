/**
 * Cart Screen
 * Shopping cart with items, quantities, and checkout
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import Colors, { BRAND } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useCartStore, formatPrice, type CartItem } from '@/stores/cart-store';

export default function CartScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const items = useCartStore((state) => state.items);
  const itemCount = useCartStore((state) => state.itemCount());
  const subtotal = useCartStore((state) => state.subtotal());
  const totalSavings = useCartStore((state) => state.totalSavings());
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const handleQuantityChange = (item: CartItem, delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      Alert.alert(
        'Remove Item',
        `Remove ${item.name} from cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
        ]
      );
    } else {
      updateQuantity(item.id, newQuantity);
    }
  };

  const handleRemoveItem = (item: CartItem) => {
    Alert.alert(
      'Remove Item',
      `Remove ${item.name} from cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  const handleCheckout = () => {
    router.push('/checkout');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Image
        source={{ uri: item.image_url || 'https://placehold.co/100x100/f8fafc/94a3b8?text=No+Image' }}
        style={styles.itemImage}
        resizeMode="cover"
      />

      <View style={styles.itemDetails}>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>

        {item.variant_name && (
          <Text style={[styles.itemVariant, { color: colors.textSecondary }]}>
            {item.variant_name}
          </Text>
        )}

        <View style={styles.priceRow}>
          <Text style={[styles.itemPrice, { color: BRAND.primary }]}>
            {formatPrice(item.price)}
          </Text>
          {item.compare_at_price && item.compare_at_price > item.price && (
            <Text style={[styles.comparePrice, { color: colors.textSecondary }]}>
              {formatPrice(item.compare_at_price)}
            </Text>
          )}
        </View>

        <View style={styles.quantityRow}>
          <View style={[styles.quantityControls, { borderColor: colors.border }]}>
            <Pressable
              style={({ pressed }) => [
                styles.quantityButton,
                pressed && styles.quantityButtonPressed,
              ]}
              onPress={() => handleQuantityChange(item, -1)}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>

            <Text style={[styles.quantityText, { color: colors.text }]}>
              {item.quantity}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.quantityButton,
                pressed && styles.quantityButtonPressed,
              ]}
              onPress={() => handleQuantityChange(item, 1)}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.removeButton,
              pressed && styles.removeButtonPressed,
            ]}
            onPress={() => handleRemoveItem(item)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cart-outline" size={80} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Your cart is empty
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Browse our products and add items to your cart
      </Text>
      <Pressable
        style={[styles.shopButton, { backgroundColor: BRAND.primary }]}
        onPress={() => router.push('/')}
      >
        <Text style={styles.shopButtonText}>Start Shopping</Text>
      </Pressable>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderEmptyCart()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Cart Items */}
      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[styles.itemCountText, { color: colors.textSecondary }]}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} in cart
            </Text>
            <Pressable onPress={handleClearCart}>
              <Text style={[styles.clearText, { color: BRAND.primary }]}>
                Clear All
              </Text>
            </Pressable>
          </View>
        }
      />

      {/* Checkout Summary */}
      <SafeAreaView edges={['bottom']} style={[styles.checkoutContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {totalSavings > 0 && (
          <View style={[styles.savingsRow, { backgroundColor: BRAND.primaryLight }]}>
            <Ionicons name="pricetag" size={16} color={BRAND.primary} />
            <Text style={[styles.savingsText, { color: BRAND.primary }]}>
              You save {formatPrice(totalSavings)}
            </Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Subtotal
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatPrice(subtotal)}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.checkoutButton,
            { backgroundColor: BRAND.primary },
            pressed && styles.checkoutButtonPressed,
          ]}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutButtonText}>
            Proceed to Checkout
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 200,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemCountText: {
    fontSize: 14,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cartItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 12,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparePrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonPressed: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonPressed: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  checkoutButtonPressed: {
    opacity: 0.9,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
