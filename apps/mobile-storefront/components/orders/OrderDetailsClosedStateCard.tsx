import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
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
      <View style={styles.cancelledStatus}>
        <Ionicons
          name={statusMeta.icon as ComponentProps<typeof Ionicons>['name']}
          size={24}
          color={statusPalette.accent}
        />
        <View style={styles.cancelledCopy}>
          <Text style={[styles.cancelledText, { color: statusPalette.accent }]}>
            {statusMeta.label}
          </Text>
          <Text style={[styles.cancelledSubtext, { color: textSecondaryColor }]}>
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
  cancelledStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cancelledCopy: {
    flex: 1,
  },
  cancelledText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelledSubtext: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
