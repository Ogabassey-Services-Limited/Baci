import type { ShippingStatus } from '@baci/shared';
import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { Order } from '@/hooks/useOrders';
import type { StatusAction, ThemeColors, ThemeShadows } from './types';

interface OrdersStatusDropdownProps {
  visible: boolean;
  selectedOrder: Order | null;
  dropdownPosition: { x: number; y: number };
  colors: ThemeColors;
  shadows: ThemeShadows;
  isUpdating: boolean;
  getStatusActions: (status: ShippingStatus) => StatusAction[];
  onClose: () => void;
  onStatusUpdate: (status: ShippingStatus) => void;
}

export function OrdersStatusDropdown({
  visible,
  selectedOrder,
  dropdownPosition,
  colors,
  shadows,
  isUpdating,
  getStatusActions,
  onClose,
  onStatusUpdate,
}: OrdersStatusDropdownProps) {
  if (!(visible && selectedOrder)) return null;

  const actions = getStatusActions(
    selectedOrder.shipping_status as ShippingStatus
  );

  return (
    <>
      <Pressable
        style={styles.dropdownBackdrop}
        onPress={onClose}
        accessibilityLabel="Close status menu"
        accessibilityRole="button"
      />
      <View
        style={[
          styles.statusDropdown,
          {
            backgroundColor: colors.card,
            top: dropdownPosition.y,
            left: dropdownPosition.x,
          },
          shadows.lg,
        ]}
      >
        {actions.length > 0 ? (
          actions.map((action, index) => (
            <StatusActionItem
              key={action.status}
              action={action}
              index={index}
              colors={colors}
              isUpdating={isUpdating}
              onStatusUpdate={onStatusUpdate}
            />
          ))
        ) : (
          <View style={styles.dropdownItem}>
            <Text
              style={[styles.dropdownItemText, { color: colors.textMuted }]}
            >
              No actions
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function StatusActionItem({
  action,
  index,
  colors,
  isUpdating,
  onStatusUpdate,
}: {
  action: StatusAction;
  index: number;
  colors: ThemeColors;
  isUpdating: boolean;
  onStatusUpdate: (status: ShippingStatus) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.dropdownItem,
        { minHeight: 44 },
        index > 0 && {
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        pressed && { backgroundColor: colors.backgroundLight },
      ]}
      onPress={() => onStatusUpdate(action.status)}
      disabled={isUpdating}
      accessibilityLabel={
        isUpdating ? `Updating to ${action.label}` : action.label
      }
      accessibilityRole="menuitem"
      accessibilityState={{ disabled: isUpdating }}
      accessibilityHint={`Change order status to ${action.label.toLowerCase()}`}
    >
      <Ionicons name={action.icon} size={18} color={action.color} />
      <Text style={[styles.dropdownItemText, { color: action.color }]}>
        {action.label}
      </Text>
      {isUpdating ? (
        <ActivityIndicator size="small" color={action.color} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  statusDropdown: {
    position: 'absolute',
    zIndex: 100,
    borderRadius: RADIUS.md,
    minWidth: 160,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
