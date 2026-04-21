import { SHIPPING_STATUS_ACTIONS, SHIPPING_STATUS_CONFIG } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import { normalizeOrderDetailsShippingStatus } from './order-details.helpers';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

type ShippingStatusKey = keyof typeof SHIPPING_STATUS_CONFIG;

interface OrderStatusSheetProps {
  colors: Pick<
    ThemeColors,
    | 'border'
    | 'cancelled'
    | 'card'
    | 'delivered'
    | 'pending'
    | 'primary'
    | 'processing'
    | 'returned'
    | 'shipped'
    | 'text'
    | 'textMuted'
    | 'textSecondary'
  >;
  onClose: () => void;
  onSelectStatus: (status: ShippingStatusKey) => void;
  shippingStatus: string;
  visible: boolean;
}

function getStatusColor(
  key: string | undefined,
  colors: OrderStatusSheetProps['colors']
) {
  const colorMap: Record<string, string> = {
    pending: colors.pending,
    processing: colors.processing,
    shipped: colors.shipped,
    delivered: colors.delivered,
    cancelled: colors.cancelled,
    returned: colors.returned,
  };

  return colorMap[key || ''] || colors.textSecondary;
}

export function OrderStatusSheet({
  colors,
  onClose,
  onSelectStatus,
  shippingStatus,
  visible,
}: OrderStatusSheetProps) {
  const normalizedStatus = normalizeOrderDetailsShippingStatus(
    shippingStatus
  ) as ShippingStatusKey;
  const availableActions = new Map(
    (SHIPPING_STATUS_ACTIONS[normalizedStatus] ?? []).map((action) => [
      action.nextStatus,
      action,
    ])
  );

  return (
    <AppSheetModal
      accessibilityLabel="Order status sheet"
      onClose={onClose}
      visible={visible}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        Update Order Status
      </Text>
      <View style={styles.options}>
        {Object.entries(SHIPPING_STATUS_CONFIG).map(([statusKey, config]) => {
          const action = availableActions.get(statusKey as ShippingStatusKey);
          const isCurrent = normalizedStatus === statusKey;
          const isAllowed = isCurrent || Boolean(action);
          const statusColor = getStatusColor(config.colorKey, colors);
          const label = isCurrent
            ? SHIPPING_STATUS_CONFIG[statusKey as ShippingStatusKey].label
            : action?.label || config.label;

          return (
            <Pressable
              key={statusKey}
              accessibilityLabel={label}
              accessibilityRole="button"
              disabled={!isAllowed}
              onPress={() => onSelectStatus(statusKey as ShippingStatusKey)}
              style={[
                styles.option,
                {
                  backgroundColor: isCurrent
                    ? `${colors.primary}10`
                    : 'transparent',
                  opacity: isAllowed ? 1 : 0.4,
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: getStatusColor(config.colorKey, colors) },
                ]}
              />
              <Text
                style={[
                  styles.optionText,
                  {
                    color: isCurrent ? colors.primary : colors.text,
                    fontWeight: isCurrent ? '700' : '500',
                  },
                ]}
              >
                {label}
              </Text>
              {isCurrent ? (
                <Ionicons color={colors.primary} name="checkmark" size={18} />
              ) : !isAllowed ? (
                <Ionicons
                  color={colors.textMuted}
                  name="lock-closed-outline"
                  size={16}
                />
              ) : (
                <Ionicons
                  color={statusColor}
                  name={
                    config.icon as React.ComponentProps<typeof Ionicons>['name']
                  }
                  size={16}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </AppSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  options: {
    gap: SPACING.sm,
  },
  option: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  dot: {
    borderRadius: RADIUS.full,
    height: 10,
    width: 10,
  },
  optionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
  },
});
