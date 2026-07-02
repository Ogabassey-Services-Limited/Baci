import { SHIPPING_STATUS_ACTIONS, SHIPPING_STATUS_CONFIG } from '@baci/shared';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';
import { OrderStatusDrawerFrame } from './OrderStatusDrawerFrame';
import { normalizeOrderDetailsShippingStatus } from './order-details.helpers';
import { logOrderStatusDebug } from './order-status-debug';

type ShippingStatusKey = keyof typeof SHIPPING_STATUS_CONFIG;

interface OrderStatusSheetProps {
  colors: Pick<
    ThemeColors,
    | 'background'
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
  const statusEntries = Object.entries(SHIPPING_STATUS_CONFIG);

  useEffect(() => {
    logOrderStatusDebug('sheet-visibility-changed', {
      availableActionCount: availableActions.size,
      normalizedStatus,
      shippingStatus,
      visible,
    });
  }, [availableActions.size, normalizedStatus, shippingStatus, visible]);

  return (
    <OrderStatusDrawerFrame
      closeLabel="Close status sheet"
      contentRowCount={statusEntries.length}
      colors={colors}
      onClose={onClose}
      title="Update Order Status"
      visible={visible}
    >
      <View style={styles.options}>
        {statusEntries.map(([statusKey, config]) => {
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
              onPress={() => {
                logOrderStatusDebug('status-option-pressed', {
                  isAllowed,
                  isCurrent,
                  label,
                  nextStatus: statusKey,
                  normalizedStatus,
                });

                onSelectStatus(statusKey as ShippingStatusKey);
              }}
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
    </OrderStatusDrawerFrame>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: SPACING.sm,
    padding: SPACING.lg,
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
    fontSize: TYPOGRAPHY.size.lg,
  },
});
