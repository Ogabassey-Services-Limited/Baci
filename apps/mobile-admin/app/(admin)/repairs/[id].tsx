import Ionicons from '@react-native-vector-icons/ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { parseOrderDetailsCurrencyInput } from '@/components/orders/order-details.formatters';
import { RepairBookingDetailContent } from '@/components/repairs/RepairBookingDetailContent';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useRepairBookingDetail } from '@/hooks/useRepairBookingDetail';
import { useTheme } from '@/hooks/useTheme';
import { useUpdateRepairBooking } from '@/hooks/useUpdateRepairBooking';
import { NetworkError } from '@/lib/api-client';
import { getAllowedNextRepairStatuses } from '@/lib/repairs/repair-status';
import { repairBookingRouteParamsSchema } from '@/schemas/repair-booking-route-params';
import type { RepairStatus } from '@/types/repair-booking';

function isPermissionDeniedError(error: unknown): boolean {
  return error instanceof NetworkError && error.statusCode === 403;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof NetworkError && error.statusCode === 404;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function RepairBookingDetailScreen() {
  const { colors } = useTheme();
  const rawParams = useLocalSearchParams<{ id?: string }>();
  const routeResult = repairBookingRouteParamsSchema.safeParse({
    id: firstParam(rawParams.id),
  });
  const bookingId = routeResult.success ? routeResult.data.id : undefined;

  const { data, error, isLoading, refetch } = useRepairBookingDetail(bookingId);
  const booking = data?.booking;
  const updateMutation = useUpdateRepairBooking();

  const [estimatedCostInput, setEstimatedCostInput] = useState('');
  const [adminNotesInput, setAdminNotesInput] = useState('');

  useEffect(() => {
    if (!booking) return;
    setEstimatedCostInput(
      booking.estimatedCost !== null ? String(booking.estimatedCost) : ''
    );
    setAdminNotesInput(booking.adminNotes ?? '');
  }, [booking]);

  if (!routeResult.success) {
    return (
      <InvalidRouteScreen
        message="The booking link is invalid. Please check and try again."
        title="Invalid Booking"
      />
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isPermissionDeniedError(error)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons color={colors.warning} name="lock-closed-outline" size={48} />
        <Text style={[styles.title, { color: colors.text }]}>
          You don't have permission to view repair bookings.
        </Text>
      </View>
    );
  }

  if (isNotFoundError(error)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons color={colors.error} name="alert-circle-outline" size={48} />
        <Text style={[styles.title, { color: colors.text }]}>
          Booking not found
        </Text>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons color={colors.error} name="alert-circle-outline" size={48} />
        <Text style={[styles.title, { color: colors.text }]}>
          Failed to load booking
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            refetch();
          }}
          style={styles.retryButton}
        >
          <Text style={{ color: colors.primary }}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const savedCostInput =
    booking.estimatedCost !== null ? String(booking.estimatedCost) : '';
  const isDirty =
    estimatedCostInput !== savedCostInput ||
    adminNotesInput !== (booking.adminNotes ?? '');

  const handleAdvanceStatus = (status: RepairStatus) => {
    updateMutation.mutate({ id: booking.id, status });
  };

  const handleSaveDetails = () => {
    const trimmedCost = estimatedCostInput.trim();
    // parseOrderDetailsCurrencyInput() strips non-digits and returns '' for
    // input with no digits (e.g. 'abc' or just '₦').
    const cleanedCost = trimmedCost
      ? parseOrderDetailsCurrencyInput(trimmedCost)
      : '';
    // Non-empty but non-numeric input is a mistake, not an intent to clear the
    // estimate — reject it so a stray keystroke can't wipe a real value. An
    // empty field still clears (null) as intended.
    if (trimmedCost && !cleanedCost) {
      Alert.alert(
        'Invalid estimated cost',
        'Enter a numeric amount, or clear the field to remove the estimate.'
      );
      return;
    }
    const parsedCost = cleanedCost ? Number(cleanedCost) : null;
    const trimmedNotes = adminNotesInput.trim();

    updateMutation.mutate({
      admin_notes: trimmedNotes ? trimmedNotes : null,
      estimated_cost:
        parsedCost !== null && Number.isFinite(parsedCost) ? parsedCost : null,
      id: booking.id,
    });
  };

  return (
    <RepairBookingDetailContent
      adminNotesInput={adminNotesInput}
      allowedNextStatuses={getAllowedNextRepairStatuses(booking.status)}
      booking={booking}
      colors={colors}
      estimatedCostInput={estimatedCostInput}
      isDirty={isDirty}
      isSaving={updateMutation.isPending}
      onAdminNotesChange={setAdminNotesInput}
      onAdvanceStatus={handleAdvanceStatus}
      onEstimatedCostChange={setEstimatedCostInput}
      onSaveDetails={handleSaveDetails}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  retryButton: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});
