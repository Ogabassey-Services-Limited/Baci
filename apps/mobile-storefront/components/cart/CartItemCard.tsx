import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeImage } from '@/components/ui/SafeImage';
import Colors, { BRAND } from '@/constants/Colors';
import type { CartItem } from '@/stores/cart-store';
import CartQuantityInput from './CartQuantityInput';
import styles from './styles';

const DEFAULT_ASSURANCE_RATE = 0.05;
const DEFAULT_ASSURANCE_PERCENT_LABEL = `${Math.round(DEFAULT_ASSURANCE_RATE * 100)}%`;

interface CartItemCardProps {
  item: CartItem;
  handleQuantityChange: (item: CartItem, delta: number) => void;
  handleRemoveItem: (item: CartItem) => void;
  toggleAssurance: (itemId: string) => void;
  openItemNegotiation: (item: CartItem) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  formatPrice: (amount: number) => string;
  colors: (typeof Colors)['light'];
  surfaceInset: string;
  disabledIconColor: string;
  negotiateSurface: string;
  negotiateBorder: string;
}

export default function CartItemCard({
  item,
  handleQuantityChange,
  handleRemoveItem,
  toggleAssurance,
  openItemNegotiation,
  updateQuantity,
  formatPrice,
  colors,
  surfaceInset,
  disabledIconColor,
  negotiateSurface,
  negotiateBorder,
}: CartItemCardProps) {
  const conditionText = item.condition ?? 'NEW';
  const isNew = conditionText.toLowerCase() === 'new';
  const priceToUse = item.negotiatedPrice ?? item.price;
  const itemTotal = priceToUse * item.quantity;
  const assuranceCost = item.hasAssurance
    ? Math.round(itemTotal * (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE))
    : 0;

  return (
    <View
      style={[
        styles.cartCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <Pressable
          style={[
            styles.imageContainer,
            {
              backgroundColor: surfaceInset,
              borderColor: colors.border,
            },
          ]}
          onPress={() => router.push(`/product/${item.slug || item.product_id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open product: ${item.name || item.slug || item.product_id}`}
        >
          <SafeImage
            source={{
              uri:
                item.image_url ||
                'https://placehold.co/100x100/f8fafc/94a3b8?text=No+Image',
            }}
            style={styles.productImage}
            contentFit="contain"
          />
        </Pressable>

        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.tagsRow}>
            <View
              style={[
                styles.conditionTag,
                isNew
                  ? [
                      styles.conditionTagNew,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.success,
                      },
                    ]
                  : [
                      styles.conditionTagUsed,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.warning,
                      },
                    ],
              ]}
            >
              <Text
                style={[
                  styles.conditionTagText,
                  isNew
                    ? [styles.conditionTagTextNew, { color: colors.success }]
                    : [styles.conditionTagTextUsed, { color: colors.warning }],
                ]}
              >
                {conditionText}
              </Text>
            </View>
            {item.color && (
              <View
                style={[
                  styles.colorTag,
                  {
                    backgroundColor: surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: item.color,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Text style={[styles.colorTagText, { color: colors.textSecondary }]}>
                  {item.color}
                </Text>
              </View>
            )}
            {item.storage && (
              <View
                style={[
                  styles.storageTag,
                  {
                    backgroundColor: surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.storageTagText, { color: colors.textSecondary }]}>
                  {item.storage}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from cart`}
        >
          <Ionicons name="trash-outline" size={18} color={BRAND.primary} />
        </Pressable>
      </View>

      <View style={[styles.dashedSeparator, { borderColor: colors.border }]} />

      <View style={styles.controlsRow}>
        <View
          style={[
            styles.quantityControls,
            {
              backgroundColor: surfaceInset,
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item, -1)}
            disabled={item.quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity for ${item.name}`}
          >
            <Ionicons
              name="remove"
              size={16}
              color={
                item.quantity <= 1 ? disabledIconColor : colors.textSecondary
              }
            />
          </Pressable>
          <CartQuantityInput
            style={[styles.quantityText, { color: colors.text }]}
            value={item.quantity}
            onChange={(newQuantity) => updateQuantity(item.id, newQuantity)}
          />
          <Pressable
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item, 1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity for ${item.name}`}
          >
            <Ionicons name="add" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.priceContainer}>
          {item.negotiatedPrice ? (
            <>
              <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                {formatPrice(item.price * item.quantity)}
              </Text>
              <Text style={[styles.negotiatedPrice, { color: colors.success }]}>
                {formatPrice(itemTotal)}
              </Text>
            </>
          ) : (
            <Text style={[styles.currentPrice, { color: colors.text }]}>
              {formatPrice(itemTotal)}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.solidSeparator, { backgroundColor: colors.border }]} />

      <View style={styles.bottomRow}>
        <Pressable
          style={styles.assuranceContainer}
          onPress={() => toggleAssurance(item.id)}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!item.hasAssurance }}
          accessibilityLabel={`Toggle Ogabassey Assurance for ${item.name}`}
        >
          <View
            style={[
              styles.toggle,
              {
                backgroundColor: item.hasAssurance
                  ? BRAND.primary
                  : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                item.hasAssurance && styles.toggleKnobActive,
                { backgroundColor: colors.cardForeground },
              ]}
            />
          </View>
          <View style={styles.assuranceInfo}>
            <View style={styles.assuranceHeader}>
              <Ionicons name="shield-checkmark" size={12} color={BRAND.primary} />
              <Text style={[styles.assuranceTitle, { color: colors.text }]}>
                Ogabassey Assurance
              </Text>
            </View>
            <Text style={[styles.assuranceDesc, { color: colors.textSecondary }]}>
              {item.hasAssurance
                ? `Screen & Liquid Damage +${formatPrice(assuranceCost)}`
                : `Device Protection (+${DEFAULT_ASSURANCE_PERCENT_LABEL})`}
            </Text>
          </View>
        </Pressable>

        {item.negotiationStatus === 'accepted' ? (
          <View
            style={[
              styles.negotiatedBadge,
              {
                backgroundColor: colors.background,
                borderColor: colors.success,
              },
            ]}
          >
            <Ionicons name="checkmark" size={12} color={colors.success} />
            <Text style={[styles.negotiatedBadgeText, { color: colors.success }]}>
              Matched
            </Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.negotiateButton,
              {
                backgroundColor: negotiateSurface,
                borderColor: negotiateBorder,
              },
            ]}
            onPress={() => openItemNegotiation(item)}
          >
            <Ionicons name="pricetag-outline" size={14} color={BRAND.primary} />
            <Text style={styles.negotiateButtonText}>Negotiate</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
