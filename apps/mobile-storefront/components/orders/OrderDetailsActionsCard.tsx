import { StyleSheet, Text, View } from 'react-native';
import { OrderDetailsActionRow } from './OrderDetailsActionRow';

interface OrderDetailsActionsCardColors {
  border: string;
  card: string;
  text: string;
  textSecondary: string;
}
interface OrderDetailsActionsCardProps {
  canCancel: boolean;
  canLeaveReview: boolean;
  canReturnOrder: boolean;
  canShowRiderContact: boolean;
  colors: OrderDetailsActionsCardColors;
  isDark: boolean;
  isReceiptReady: boolean;
  onCallRider: () => void;
  onCancelOrder: () => void;
  onLeaveGoogleReview: () => void;
  onOpenReceipt: () => void;
  onReturnOrder: () => void;
  riderPhoneNumber?: string | null;
}
const ACTION_COLORS = {
  receipt: '#059669',
  rider: '#2563EB',
  review: '#D97706',
  return: '#6B7280',
  cancel: '#DC2626',
} as const;
const ACTION_SURFACES = {
  receipt: {
    dark: 'rgba(5, 150, 105, 0.16)',
    light: 'rgba(5, 150, 105, 0.10)',
  },
  rider: { dark: 'rgba(37, 99, 235, 0.18)', light: 'rgba(37, 99, 235, 0.10)' },
  review: {
    dark: 'rgba(245, 158, 11, 0.18)',
    light: 'rgba(245, 158, 11, 0.10)',
  },
  return: {
    dark: 'rgba(107, 114, 128, 0.18)',
    light: 'rgba(107, 114, 128, 0.10)',
  },
  cancel: { dark: 'rgba(220, 38, 38, 0.18)', light: 'rgba(220, 38, 38, 0.10)' },
} as const;

function getSurface(key: keyof typeof ACTION_SURFACES, isDark: boolean) {
  return isDark ? ACTION_SURFACES[key].dark : ACTION_SURFACES[key].light;
}

export function OrderDetailsActionsCard({
  canCancel,
  canLeaveReview,
  canReturnOrder,
  canShowRiderContact,
  colors,
  isDark,
  isReceiptReady,
  onCallRider,
  onCancelOrder,
  onLeaveGoogleReview,
  onOpenReceipt,
  onReturnOrder,
  riderPhoneNumber,
}: OrderDetailsActionsCardProps) {
  const hasRiderContact = canShowRiderContact && Boolean(riderPhoneNumber);

  if (
    !isReceiptReady &&
    !hasRiderContact &&
    !canLeaveReview &&
    !canReturnOrder &&
    !canCancel
  ) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
      <View style={styles.actionStack}>
        {isReceiptReady ? (
          <OrderDetailsActionRow
            accessibilityLabel="View receipt"
            accessoryIcon="chevron-forward"
            colors={colors}
            description="Preview and share your order receipt."
            icon="receipt-outline"
            iconColor={ACTION_COLORS.receipt}
            iconSurface={getSurface('receipt', isDark)}
            onPress={onOpenReceipt}
            title="View Receipt"
          />
        ) : null}
        {hasRiderContact ? (
          <OrderDetailsActionRow
            accessibilityLabel={
              riderPhoneNumber ? `Call rider ${riderPhoneNumber}` : 'Call rider'
            }
            accessoryIcon="chevron-forward"
            colors={colors}
            description="Call the rider directly for a live delivery update."
            icon="call-outline"
            iconColor={ACTION_COLORS.rider}
            iconSurface={getSurface('rider', isDark)}
            onPress={onCallRider}
            title={`Rider ${riderPhoneNumber}`}
          />
        ) : null}
        {canLeaveReview ? (
          <OrderDetailsActionRow
            accessibilityLabel="Leave a Google Review"
            accessoryIcon="open-outline"
            colors={colors}
            description="Share your delivery experience publicly."
            icon="star-outline"
            iconColor={ACTION_COLORS.review}
            iconSurface={getSurface('review', isDark)}
            onPress={onLeaveGoogleReview}
            title="Leave a Google Review"
          />
        ) : null}
        {canReturnOrder ? (
          <OrderDetailsActionRow
            accessibilityLabel="Return order"
            accessoryIcon="chevron-forward"
            colors={colors}
            description="Start a return with support while the in-app flow lands."
            icon="return-down-back-outline"
            iconColor={ACTION_COLORS.return}
            iconSurface={getSurface('return', isDark)}
            onPress={onReturnOrder}
            title="Return Order"
          />
        ) : null}
        {canCancel ? (
          <OrderDetailsActionRow
            accessibilityLabel="Cancel order"
            accessoryIcon="chevron-forward"
            colors={colors}
            description="Cancel this order before it ships."
            icon="close-circle-outline"
            iconColor={ACTION_COLORS.cancel}
            iconSurface={getSurface('cancel', isDark)}
            onPress={onCancelOrder}
            title="Cancel Order"
            titleColor={ACTION_COLORS.cancel}
          />
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  actionStack: {
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
});
