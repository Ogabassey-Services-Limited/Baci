import Ionicons from '@react-native-vector-icons/ionicons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useEditOrderController } from '@/hooks/useEditOrderController';

interface EditOrderFooterBarProps {
  controller: ReturnType<typeof useEditOrderController>;
  onLayout?: ViewProps['onLayout'];
}

export function EditOrderFooterBar({
  controller,
  onLayout,
}: EditOrderFooterBarProps) {
  const insets = useSafeAreaInsets();
  const isSaveDisabled =
    controller.isSubmitting || controller.orderItems.length === 0;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.footer,
        {
          backgroundColor: controller.colors.card,
          borderTopColor: controller.colors.border,
          paddingBottom: 18 + insets.bottom,
        },
      ]}
    >
      <Pressable
        accessibilityLabel="Notify customer"
        accessibilityRole="switch"
        accessibilityState={{
          checked: controller.notifyCustomer,
          disabled: controller.isSubmitting,
        }}
        disabled={controller.isSubmitting}
        onPress={() => controller.setNotifyCustomer(!controller.notifyCustomer)}
        style={styles.notifyRow}
      >
        <View>
          <Text style={[styles.notifyLabel, { color: controller.colors.text }]}>
            Notify customer
          </Text>
          {controller.isFinancialLocked ? (
            <Text
              style={[
                styles.lockText,
                { color: controller.colors.textSecondary },
              ]}
            >
              Payments or fulfillment may lock item and total changes.
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.switchTrack,
            {
              backgroundColor: controller.notifyCustomer
                ? controller.colors.primary
                : controller.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.switchThumb,
              {
                backgroundColor: controller.colors.card,
                transform: [{ translateX: controller.notifyCustomer ? 18 : 0 }],
              },
            ]}
          />
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <View>
          <Text
            style={[
              styles.totalLabel,
              { color: controller.colors.textSecondary },
            ]}
          >
            Updated Total
          </Text>
          <Text style={[styles.totalValue, { color: controller.colors.text }]}>
            {controller.formatPrice(controller.total)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Save Changes"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaveDisabled }}
          disabled={isSaveDisabled}
          onPress={controller.handleSubmit}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: controller.colors.primary,
              opacity: isSaveDisabled ? 0.55 : pressed ? 0.72 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.saveButtonText,
              { color: controller.colors.textOnPrimary },
            ]}
          >
            Save Changes
          </Text>
          <Ionicons
            color={controller.colors.textOnPrimary}
            name="checkmark"
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  lockText: {
    fontSize: 12,
    marginTop: 2,
  },
  notifyLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  notifyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  switchThumb: {
    borderRadius: 11,
    height: 22,
    width: 22,
  },
  switchTrack: {
    borderRadius: 14,
    padding: 3,
    width: 46,
  },
  totalLabel: {
    fontSize: 12,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
});
