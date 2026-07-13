import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatRepairBookingDate } from '@/lib/repairs/format-repair-booking-date';
import type { RepairBookingSummary } from '@/types/repair-booking';
import { formatCurrency } from '@/utils/format';
import { RepairStatusBadge } from './RepairStatusBadge';

interface RepairBookingListItemProps {
  booking: RepairBookingSummary;
  colors: ThemeColors;
  onPress: (id: string) => void;
}

export function RepairBookingListItem({
  booking,
  colors,
  onPress,
}: RepairBookingListItemProps) {
  const serviceLabel = booking.serviceType === 'pickup' ? 'Pickup' : 'Dropoff';
  const priceLabel =
    booking.quotedPrice !== null
      ? formatCurrency(booking.quotedPrice)
      : 'Quote pending';

  return (
    <Pressable
      accessibilityHint={`Open booking ${booking.ticketNumber}`}
      accessibilityLabel={`Booking #${booking.ticketNumber}, ${booking.deviceLabel}`}
      accessibilityRole="button"
      onPress={() => onPress(booking.id)}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.ticket, { color: colors.textSecondary }]}>
          #{booking.ticketNumber}
        </Text>
        <RepairStatusBadge colors={colors} status={booking.status} />
      </View>

      <Text style={[styles.device, { color: colors.text }]}>
        {booking.deviceLabel}
      </Text>

      <View style={styles.metaRow}>
        {booking.repairTypeLabel ? (
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {booking.repairTypeLabel}
          </Text>
        ) : null}
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {serviceLabel}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.price, { color: colors.primary }]}>
          {priceLabel}
        </Text>
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {formatRepairBookingDate(booking.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  date: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
  },
  device: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  price: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  ticket: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
