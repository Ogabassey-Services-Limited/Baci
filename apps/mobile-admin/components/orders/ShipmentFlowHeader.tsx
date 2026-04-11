import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { ShipmentFlowStep } from '@/lib/order-shipment';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentFlowHeaderProps {
  colors: ThemeColors;
  isSubmitting: boolean;
  onClose: () => void;
  orderNumber: string;
  step: ShipmentFlowStep;
}

export function ShipmentFlowHeader({
  colors,
  isSubmitting,
  onClose,
  orderNumber,
  step,
}: ShipmentFlowHeaderProps) {
  const titles = {
    details: 'Fulfillment Details',
    method: 'Choose Shipping Method',
    rider: 'Dispatch Rider',
  } satisfies Record<ShipmentFlowStep, string>;
  const title = titles[step] ?? titles.rider;

  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
          Ship {orderNumber}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <Pressable
        accessibilityLabel="Close shipment flow"
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        hitSlop={8}
        onPress={onClose}
        style={[
          styles.closeButton,
          {
            backgroundColor: colors.backgroundLight,
            opacity: isSubmitting ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}
