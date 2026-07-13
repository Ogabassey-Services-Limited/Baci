import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { formatRepairBookingDate } from '@/lib/repairs/format-repair-booking-date';
import { getRepairStatusLabel } from '@/lib/repairs/repair-status';
import type { RepairBookingDetail, RepairStatus } from '@/types/repair-booking';
import { formatCurrency } from '@/utils/format';
import { repairBookingDetailStyles as styles } from './RepairBookingDetailContent.styles';
import { RepairStatusBadge } from './RepairStatusBadge';

interface RepairBookingDetailContentProps {
  adminNotesInput: string;
  allowedNextStatuses: readonly RepairStatus[];
  booking: RepairBookingDetail;
  colors: ThemeColors;
  estimatedCostInput: string;
  isDirty: boolean;
  isSaving: boolean;
  onAdminNotesChange: (value: string) => void;
  onAdvanceStatus: (status: RepairStatus) => void;
  onEstimatedCostChange: (value: string) => void;
  onSaveDetails: () => void;
}

/** Read-and-edit content for a single repair booking (thin `[id].tsx` renders this once loaded). */
export function RepairBookingDetailContent({
  adminNotesInput,
  allowedNextStatuses,
  booking,
  colors,
  estimatedCostInput,
  isDirty,
  isSaving,
  onAdminNotesChange,
  onAdvanceStatus,
  onEstimatedCostChange,
  onSaveDetails,
}: RepairBookingDetailContentProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
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
      {booking.repairTypeLabel ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {booking.repairTypeLabel}
        </Text>
      ) : null}
      {booking.issueDescription ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {booking.issueDescription}
        </Text>
      ) : null}
      <Text style={[styles.body, { color: colors.textMuted }]}>
        Booked {formatRepairBookingDate(booking.createdAt)}
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Customer
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>
          {booking.customerName}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {booking.customerEmail}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {booking.customerPhone}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {booking.serviceType === 'pickup' ? 'Pickup' : 'Dropoff'}
        </Text>
        {booking.serviceType === 'pickup' ? (
          <>
            <Text style={[styles.body, { color: colors.text }]}>
              {booking.pickupAddress ?? 'Address not provided'}
            </Text>
            {booking.trackingNumber ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Tracking: {booking.trackingNumber}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Dropoff at store
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Quote
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>
          {booking.quotedPrice !== null
            ? formatCurrency(booking.quotedPrice)
            : 'No quote recorded'}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Estimated cost
        </Text>
        <TextInput
          accessibilityLabel="Estimated cost"
          keyboardType="numeric"
          onChangeText={onEstimatedCostChange}
          placeholder="0"
          style={[
            styles.input,
            { borderColor: colors.border, color: colors.text },
          ]}
          value={estimatedCostInput}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Admin notes
        </Text>
        <TextInput
          accessibilityLabel="Admin notes"
          multiline
          onChangeText={onAdminNotesChange}
          style={[
            styles.input,
            styles.notesInput,
            { borderColor: colors.border, color: colors.text },
          ]}
          value={adminNotesInput}
        />

        <Pressable
          accessibilityRole="button"
          disabled={!isDirty || isSaving}
          onPress={onSaveDetails}
          style={[
            styles.saveButton,
            {
              backgroundColor: colors.primary,
              opacity: !isDirty || isSaving ? 0.5 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.textOnPrimary }}>Save changes</Text>
        </Pressable>
      </View>

      {allowedNextStatuses.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Advance status
          </Text>
          <View style={styles.statusButtonRow}>
            {allowedNextStatuses.map((status) => (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={status}
                onPress={() => onAdvanceStatus(status)}
                style={[styles.statusButton, { borderColor: colors.primary }]}
              >
                <Text style={{ color: colors.primary }}>
                  {getRepairStatusLabel(status)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
