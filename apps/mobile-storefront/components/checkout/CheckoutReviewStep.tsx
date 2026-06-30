import { Pressable, ScrollView, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { SHADOWS } from '@/constants/Colors';
import type { ShippingAddressInput } from '@/lib/validation';
import { type CartItem, formatPrice } from '@/stores/cart-store';
import { checkoutReviewStyles as styles } from './CheckoutReviewStep.styles';
import { getDeliveryMethodLabel } from './checkout-step-helpers';
import type { PaymentMethodType } from './PaymentMethodSelector';
import { PICKUP_STATION_ADDRESS_LINES } from './PickupStationCard';
import type { DeliveryMethod, ShippingQuote } from './types';

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  paystack: 'Card Payment (Paystack)',
  korapay: 'Card Payment (Korapay)',
  bank_transfer: 'Bank Transfer',
  pay_on_delivery: 'Pay on Delivery',
  credpal: 'CredPal (Buy Now Pay Later)',
  credit_direct: 'Credit Direct (Installments)',
  klump: 'Klump (Buy Now Pay Later)',
  juicyway: 'Crypto (Juicyway)',
  invoice: 'Generate Invoice',
  payforme: 'Pay for Me',
};

type CheckoutReviewStepProps = {
  address: ShippingAddressInput;
  assuranceFee: number;
  colors: (typeof Colors)['light'];
  deliveryFee: number;
  deliveryMethod: DeliveryMethod;
  formContentPaddingBottom: number;
  isDark: boolean;
  items: CartItem[];
  onEditAddress: () => void;
  onEditPayment: () => void;
  selectedPayment: PaymentMethodType;
  selectedQuote?: ShippingQuote;
  subtotal: number;
  taxAmount: number | null;
  taxRate: number;
  total: number;
};

export function CheckoutReviewStep({
  address,
  assuranceFee,
  colors,
  deliveryFee,
  deliveryMethod,
  formContentPaddingBottom,
  isDark,
  items,
  onEditAddress,
  onEditPayment,
  selectedPayment,
  selectedQuote,
  subtotal,
  taxAmount,
  taxRate,
  total,
}: CheckoutReviewStepProps) {
  const cardSurface = {
    backgroundColor: colors.card,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
    ...SHADOWS.sm,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: formContentPaddingBottom }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Review Order
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Confirm your details before placing the order.
        </Text>
      </View>

      <View style={[styles.reviewCard, cardSurface]}>
        <View style={styles.reviewHeader}>
          <Text style={[styles.reviewTitle, { color: colors.text }]}>
            Delivery Method
          </Text>
          <Pressable
            accessibilityLabel="Edit delivery method"
            accessibilityRole="button"
            onPress={onEditAddress}
          >
            <Text style={[styles.editLink, { color: colors.primary }]}>
              Edit
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.reviewTextStrong, { color: colors.text }]}>
          {getDeliveryMethodLabel(deliveryMethod)}
        </Text>
        {selectedQuote && deliveryMethod === 'door' ? (
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {selectedQuote.displayName}
            {selectedQuote.deliveryRange || selectedQuote.estimatedDays
              ? ` • ${selectedQuote.deliveryRange ?? `${selectedQuote.estimatedDays} days`}`
              : null}
          </Text>
        ) : null}
        {deliveryMethod === 'airport' ? (
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {'Delivery to your doorstep \u2022 Est. 24\u201348 working hours'}
          </Text>
        ) : null}
      </View>

      <View style={[styles.reviewCard, cardSurface]}>
        <View style={styles.reviewHeader}>
          <Text style={[styles.reviewTitle, { color: colors.text }]}>
            Delivery Address
          </Text>
        </View>
        <Text style={[styles.reviewText, { color: colors.text }]}>
          {address.firstName} {address.lastName}
        </Text>
        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
          {address.phone}
        </Text>
        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
          {deliveryMethod === 'pickup_station'
            ? PICKUP_STATION_ADDRESS_LINES.join('\n')
            : deliveryMethod === 'airport'
              ? `${address.city}, ${address.state}`
              : address.address}
        </Text>
      </View>

      <View style={[styles.reviewCard, cardSurface]}>
        <View style={styles.reviewHeader}>
          <Text style={[styles.reviewTitle, { color: colors.text }]}>
            Payment Method
          </Text>
          <Pressable
            accessibilityLabel="Edit payment method"
            accessibilityRole="button"
            onPress={onEditPayment}
          >
            <Text style={[styles.editLink, { color: colors.primary }]}>
              Edit
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
          {PAYMENT_METHOD_LABELS[selectedPayment]}
        </Text>
      </View>

      <View style={[styles.reviewCard, cardSurface]}>
        <Text style={[styles.reviewTitle, { color: colors.text }]}>
          Order Items ({items.length})
        </Text>
        {items.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <Text style={[styles.orderItemName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text
              style={[styles.orderItemQty, { color: colors.textSecondary }]}
            >
              x{item.quantity}
            </Text>
            <Text style={[styles.orderItemPrice, { color: colors.text }]}>
              {formatPrice(
                (item.negotiatedPrice ?? item.price) * item.quantity
              )}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.totalCard, cardSurface]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            Subtotal
          </Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {formatPrice(subtotal)}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            Delivery
          </Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {formatPrice(deliveryFee)}
          </Text>
        </View>
        {assuranceFee > 0 ? (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Device Assurance
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(assuranceFee)}
            </Text>
          </View>
        ) : null}
        {taxAmount !== null && taxRate > 0 ? (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              VAT ({(taxRate * 100).toFixed(1)}%)
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(taxAmount)}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.totalRow,
            styles.grandTotalRow,
            { borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.grandTotalLabel, { color: colors.text }]}>
            Total
          </Text>
          <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
            {formatPrice(total)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
