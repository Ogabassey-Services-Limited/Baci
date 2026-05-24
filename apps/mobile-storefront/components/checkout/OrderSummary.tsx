import Ionicons from "@react-native-vector-icons/ionicons/static";
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeImage } from '@/components/ui/SafeImage';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, RADIUS, SPACING } from '@/constants/Colors';
import { type CartItem, formatPrice } from '@/stores/cart-store';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export function OrderSummary({
  items,
  subtotal,
  deliveryFee,
  total,
}: OrderSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsExpanded(!isExpanded);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        onPress={toggleExpand}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Toggle order summary"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="cart-outline" size={20} color={BRAND.primary} />
          <Text style={[styles.headerTitle, { color: BRAND.primary }]}>
            {isExpanded ? 'Hide' : 'Show'} order summary
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={BRAND.primary}
          />
        </View>
        <Text style={[styles.headerTotal, { color: colors.text }]}>
          {formatPrice(total)}
        </Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.content}>
          <View style={styles.itemsList}>
            {items
              .filter(
                (item) =>
                  item?.name && item.price != null && item.quantity != null
              )
              .map((item, index) => (
                <View key={item.id || index} style={styles.itemRow}>
                  <View style={styles.imageContainer}>
                    <SafeImage
                      source={{ uri: item.image_url ?? '' }}
                      style={styles.itemImage}
                      contentFit="contain"
                    />
                    <View style={styles.quantityBadge}>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                    </View>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[styles.itemName, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.itemPrice,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatPrice(item.negotiatedPrice ?? item.price)}
                    </Text>
                  </View>
                  <Text style={[styles.itemRowTotal, { color: colors.text }]}>
                    {formatPrice(
                      (item.negotiatedPrice ?? item.price) * item.quantity
                    )}
                  </Text>
                </View>
              ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Subtotal
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(subtotal)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Delivery
            </Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color: deliveryFee === 0 ? colors.textSecondary : colors.text,
                },
              ]}
            >
              {deliveryFee === 0
                ? 'Calculated at next step'
                : formatPrice(deliveryFee)}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              Total
            </Text>
            <View style={styles.totalValueContainer}>
              <Text style={styles.currencyCode}>NGN</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatPrice(total)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.md,
    marginTop: -40,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    paddingBottom: SPACING.lg,
  },
  itemsList: {
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  imageContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.gray[200],
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '90%',
    height: '90%',
  },
  quantityBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: palette.gray[700],
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  quantityText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  itemPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  itemRowTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  totalValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  currencyCode: {
    fontSize: 10,
    color: palette.gray[400],
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
  },
});
