/**
 * StickyBottomActions - The fixed bottom bar on the product detail screen.
 * Shows a quantity controller + "View Cart" when the item is in the cart,
 * or a single "Add to Cart" button when it is not.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { BRAND, SHADOWS } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

export interface StickyBottomActionsProps {
  canPurchase: boolean;
  quantityInCart: number;
  localQty: string;
  onLocalQtyChange: (text: string) => void;
  onLocalQtyBlur: () => void;
  onDecrement: (event: GestureResponderEvent) => void;
  onIncrement: (event: GestureResponderEvent) => void;
  onAddToCart: (event: GestureResponderEvent) => void;
  colors: ColorsScheme;
  paddingBottom?: number;
}

export function StickyBottomActions({
  canPurchase,
  quantityInCart,
  localQty,
  onLocalQtyChange,
  onLocalQtyBlur,
  onDecrement,
  onIncrement,
  onAddToCart,
  colors,
  paddingBottom = 16,
}: StickyBottomActionsProps) {
  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom,
        },
      ]}
    >
      <Animated.View
        layout={LinearTransition.springify().damping(18).stiffness(120)}
        style={{ width: '100%' }}
      >
        {quantityInCart > 0 ? (
          <View
            key="cart-active"
            style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 0 }}
          >
            {/* Quantity Controller */}
            <View style={styles.qtyController}>
              <Pressable
                onPress={(e) => onDecrement(e)}
                style={styles.qtyButton}
                hitSlop={10}
                accessibilityLabel={
                  quantityInCart === 1
                    ? 'Remove from cart'
                    : 'Decrease quantity'
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name={quantityInCart === 1 ? 'trash-outline' : 'remove'}
                  size={22}
                  color={BRAND.primary}
                />
              </Pressable>

              <View style={styles.qtyCenter}>
                <Text style={styles.qtyLabel}>In Cart</Text>
                <TextInput
                  style={styles.qtyInput}
                  value={localQty}
                  onChangeText={onLocalQtyChange}
                  onBlur={onLocalQtyBlur}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>

              <Pressable
                onPress={(e) => onIncrement(e)}
                style={styles.qtyButtonRight}
                hitSlop={10}
                accessibilityLabel="Increase quantity"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={22} color={BRAND.primary} />
              </Pressable>
            </View>

            {/* View Cart Button */}
            <Pressable
              onPress={() => router.push('/(tabs)/cart')}
              style={styles.viewCartBtn}
              accessibilityRole="button"
              accessibilityLabel="View Cart"
            >
              <Ionicons name="cart-outline" size={20} color="#FFF" />
              <Text style={styles.viewCartText}>View Cart</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[
              styles.addToCartBtn,
              { backgroundColor: canPurchase ? BRAND.primary : colors.border },
              canPurchase ? SHADOWS.md : null,
            ]}
            disabled={!canPurchase}
            onPress={onAddToCart}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPurchase }}
            accessibilityLabel={
              canPurchase ? 'Add to Cart' : 'Product out of stock'
            }
          >
            <Ionicons
              name="cart-outline"
              size={22}
              color={canPurchase ? '#FFF' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.addToCartBtnText,
                { color: canPurchase ? '#FFF' : colors.textSecondary },
              ]}
            >
              {canPurchase ? 'Add to Cart' : 'Out of Stock'}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
    borderTopWidth: 1,
  },
  qtyController: {
    flex: 1.2,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BRAND.primary,
  },
  qtyButton: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#FEE2E2',
  },
  qtyButtonRight: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#FEE2E2',
  },
  qtyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -2,
  },
  qtyInput: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    minWidth: 40,
    padding: 0,
    margin: 0,
  },
  viewCartBtn: {
    flex: 1,
    height: 56,
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.md,
  },
  viewCartText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  addToCartBtn: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  addToCartBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
