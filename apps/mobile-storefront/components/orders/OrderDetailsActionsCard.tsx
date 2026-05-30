import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OrderDetailsActionsCardColors {
  border: string;
  card: string;
  text: string;
  textSecondary: string;
}
interface OrderDetailsActionsCardProps {
  canLeaveReview: boolean;
  canReturnOrder: boolean;
  canShowRiderContact: boolean;
  colors: OrderDetailsActionsCardColors;
  isDark: boolean;
  isReceiptReady: boolean;
  onCallRider: () => void;
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
} as const;
const ACTION_SURFACES = {
  receipt: {
    dark: 'rgba(5, 150, 105, 0.16)',
    light: 'rgba(5, 150, 105, 0.10)',
  },
  rider: {
    dark: 'rgba(37, 99, 235, 0.18)',
    light: 'rgba(37, 99, 235, 0.10)',
  },
  review: {
    dark: 'rgba(245, 158, 11, 0.18)',
    light: 'rgba(245, 158, 11, 0.10)',
  },
  return: {
    dark: 'rgba(107, 114, 128, 0.18)',
    light: 'rgba(107, 114, 128, 0.10)',
  },
} as const;

export function OrderDetailsActionsCard({
  canLeaveReview,
  canReturnOrder,
  canShowRiderContact,
  colors,
  isDark,
  isReceiptReady,
  onCallRider,
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
    !canReturnOrder
  ) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
      <View style={styles.actionStack}>
        {isReceiptReady ? (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={onOpenReceipt}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="View receipt"
          >
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor: isDark
                    ? ACTION_SURFACES.receipt.dark
                    : ACTION_SURFACES.receipt.light,
                },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={18}
                color={ACTION_COLORS.receipt}
              />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                View Receipt
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                Preview and share your order receipt.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
        {hasRiderContact ? (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={onCallRider}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={
              riderPhoneNumber ? `Call rider ${riderPhoneNumber}` : 'Call rider'
            }
          >
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor: isDark
                    ? ACTION_SURFACES.rider.dark
                    : ACTION_SURFACES.rider.light,
                },
              ]}
            >
              <Ionicons
                name="call-outline"
                size={18}
                color={ACTION_COLORS.rider}
              />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Rider {riderPhoneNumber}
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                Call the rider directly for a live delivery update.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
        {canLeaveReview ? (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={onLeaveGoogleReview}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Leave a Google Review"
          >
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor: isDark
                    ? ACTION_SURFACES.review.dark
                    : ACTION_SURFACES.review.light,
                },
              ]}
            >
              <Ionicons
                name="star-outline"
                size={18}
                color={ACTION_COLORS.review}
              />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Leave a Google Review
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                Share your delivery experience publicly.
              </Text>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
        {canReturnOrder ? (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={onReturnOrder}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Return order"
          >
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor: isDark
                    ? ACTION_SURFACES.return.dark
                    : ACTION_SURFACES.return.light,
                },
              ]}
            >
              <Ionicons
                name="return-down-back-outline"
                size={18}
                color={ACTION_COLORS.return}
              />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Return Order
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                Start a return with support while the in-app flow lands.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  actionCopy: {
    flex: 1,
  },
  actionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  actionIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionStack: {
    gap: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
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
