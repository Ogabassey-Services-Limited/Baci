import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { repairBookingStyles as booking } from '@/components/repairs/repair-booking.styles';
import { repairsCatalogStyles as styles } from '@/components/repairs/repairs-catalog.styles';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';

interface RepairBookingSuccessProps {
  ticketNumber: number;
  onDone: () => void;
}

/**
 * Post-booking confirmation: shows the ticket number the customer can quote
 * when following up (also emailed to them by the booking route's
 * notification side-effect).
 */
export function RepairBookingSuccess({
  ticketNumber,
  onDone,
}: RepairBookingSuccessProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <View style={booking.successIcon}>
        <Ionicons name="checkmark-circle" size={44} color={BRAND.primary} />
      </View>
      <Text style={[booking.successTitle, { color: colors.text }]}>
        Repair request received
      </Text>
      <View style={booking.ticketBadge}>
        <Text style={[booking.ticketLabel, { color: colors.textSecondary }]}>
          Your ticket
        </Text>
        <Text style={booking.ticketNumber}>#{ticketNumber}</Text>
      </View>
      <Text style={[booking.successBody, { color: colors.textSecondary }]}>
        We've emailed your confirmation. Our team will review the details and
        reach out shortly to arrange your repair.
      </Text>
      <Pressable
        style={styles.primaryButton}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={styles.primaryButtonText}>Done</Text>
      </Pressable>
    </View>
  );
}
