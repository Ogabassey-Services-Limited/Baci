import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CUSTOMER_ORDER_PROGRESS_STEPS,
  getCustomerOrderProgressState,
  type CustomerOrderStatusMeta,
} from '@/lib/customer-order-status';
import { BRAND } from '@/constants/Colors';

interface OrderDetailsTimelineCardColors {
  border: string;
  card: string;
  muted: string;
  text: string;
  textSecondary: string;
}

interface OrderDetailsTimelineCardStatusPalette {
  accent: string;
  border: string;
  surface: string;
}

interface OrderDetailsTimelineCardProps {
  shippingStatus: string;
  statusMeta: CustomerOrderStatusMeta;
  statusPalette: OrderDetailsTimelineCardStatusPalette;
  colors: OrderDetailsTimelineCardColors;
  trackingNumber?: string;
  onTrackOrder: () => void;
}

export function OrderDetailsTimelineCard({
  shippingStatus,
  statusMeta,
  statusPalette,
  colors,
  trackingNumber,
  onTrackOrder,
}: OrderDetailsTimelineCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Status</Text>
      <View style={[styles.timelineTrack, { backgroundColor: colors.border }]} />
      <View style={styles.timeline}>
        {CUSTOMER_ORDER_PROGRESS_STEPS.map((step) => {
          const progressState = getCustomerOrderProgressState(
            shippingStatus,
            step.key
          );
          const isCompleted = progressState === 'completed';
          const isCurrent = progressState === 'current';
          const isUpcoming = progressState === 'upcoming';

          return (
            <View key={step.key} style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineIcon,
                  (isCompleted || isCurrent) && {
                    backgroundColor: isCurrent
                      ? statusPalette.accent
                      : statusPalette.surface,
                    borderColor: isCurrent
                      ? statusPalette.accent
                      : statusPalette.border,
                  },
                  isUpcoming && {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={16}
                  color={
                    isCurrent
                      ? '#FFF'
                      : isCompleted
                        ? statusPalette.accent
                        : colors.textSecondary
                  }
                />
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  {
                    color: isCurrent ? statusPalette.accent : colors.text,
                  },
                  isCurrent && styles.timelineLabelActive,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.timelineSummary,
          {
            backgroundColor: statusPalette.surface,
            borderColor: statusPalette.border,
          },
        ]}
      >
        <Ionicons
          name={statusMeta.icon}
          size={18}
          color={statusPalette.accent}
        />
        <View style={styles.timelineSummaryCopy}>
          <Text style={[styles.timelineSummaryTitle, { color: statusPalette.accent }]}>
            {statusMeta.label}
          </Text>
          <Text
            style={[styles.timelineSummaryDescription, { color: colors.textSecondary }]}
          >
            {statusMeta.description}
          </Text>
        </View>
      </View>

      {Boolean(trackingNumber) && (
        <TouchableOpacity
          style={[styles.trackButton, { borderColor: BRAND.primary }]}
          onPress={onTrackOrder}
          accessibilityRole="button"
          accessibilityLabel="Track order"
        >
          <Ionicons name="location-outline" size={18} color={BRAND.primary} />
          <Text style={[styles.trackButtonText, { color: BRAND.primary }]}>
            Track Order
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineTrack: {
    height: 2,
    marginTop: 15,
    marginHorizontal: 34,
    marginBottom: -17,
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  timelineLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    width: '100%',
    paddingHorizontal: 4,
  },
  timelineLabelActive: {
    fontWeight: '700',
  },
  timelineSummary: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineSummaryCopy: {
    flex: 1,
  },
  timelineSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineSummaryDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
