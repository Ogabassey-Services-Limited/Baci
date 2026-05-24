import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Text, View } from 'react-native';
import type { CustomerOrderStatusMeta } from '@/lib/customer-order-status';

interface OrderDetailsClosedStatePalette {
  accent: string;
  border: string;
  surface: string;
}

interface OrderDetailsClosedStateCardProps {
  statusMeta: CustomerOrderStatusMeta;
  statusPalette: OrderDetailsClosedStatePalette;
  textSecondaryColor: string;
}

export function OrderDetailsClosedStateCard({
  statusMeta,
  statusPalette,
  textSecondaryColor,
}: OrderDetailsClosedStateCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: statusPalette.surface,
          borderColor: statusPalette.border,
        },
      ]}
    >
      <View style={styles.closedStatus}>
        <Ionicons
          accessibilityLabel={`${statusMeta.key} status icon`}
          name={statusMeta.icon}
          size={24}
          color={statusPalette.accent}
        />
        <View style={styles.closedCopy}>
          <Text style={[styles.closedText, { color: statusPalette.accent }]}>
            {statusMeta.label}
          </Text>
          <Text style={[styles.closedSubtext, { color: textSecondaryColor }]}>
            {statusMeta.description}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  closedStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  closedCopy: {
    flex: 1,
  },
  closedText: {
    fontSize: 15,
    fontWeight: '700',
  },
  closedSubtext: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
