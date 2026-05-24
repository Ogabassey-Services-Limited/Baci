import Ionicons from "@react-native-vector-icons/ionicons/static";
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CustomerOrderStatusMeta } from '@/lib/customer-order-status';

interface OrderDetailsHeaderCardColors {
  text: string;
  textSecondary: string;
}

interface OrderDetailsHeaderCardStatusPalette {
  accent: string;
  surface: string;
}

interface OrderDetailsHeaderCardProps {
  orderNumber: string;
  createdAt: string;
  statusMeta: CustomerOrderStatusMeta;
  statusPalette: OrderDetailsHeaderCardStatusPalette;
  colors: OrderDetailsHeaderCardColors;
  formatDate: (dateString: string) => string;
}

export function OrderDetailsHeaderCard({
  orderNumber,
  createdAt,
  statusMeta,
  statusPalette,
  colors,
  formatDate,
}: OrderDetailsHeaderCardProps) {
  return (
    <View style={styles.orderHeader}>
      <View
        style={[styles.orderHeaderIcon, { backgroundColor: statusPalette.surface }]}
      >
        <Ionicons
          name={statusMeta.icon as ComponentProps<typeof Ionicons>['name']}
          size={20}
          color={statusPalette.accent}
        />
      </View>
      <View style={styles.orderHeaderCopy}>
        <View style={styles.orderHeaderTopRow}>
          <Text style={[styles.orderNumber, { color: colors.text }]}>
            Order #{orderNumber}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: statusPalette.surface }]}>
            <Text style={[styles.statusChipText, { color: statusPalette.accent }]}>
              {statusMeta.shortLabel}
            </Text>
          </View>
        </View>
        <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
          {formatDate(createdAt)}
        </Text>
        <Text style={[styles.orderStatusDescription, { color: colors.textSecondary }]}>
          {statusMeta.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orderHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  orderHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderHeaderCopy: {
    flex: 1,
  },
  orderHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 8,
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  orderDate: {
    fontSize: 14,
    marginTop: 4,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderStatusDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
});
