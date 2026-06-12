import { StyleSheet, Text, View } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { Order } from '@/hooks/useOrders';
import { groupOrdersByRelativeDate } from '@/utils/date-utils';
import type { OrdersListRow, ThemeColors } from './types';

export function buildOrdersListData(allOrders: Order[]) {
  const rows: OrdersListRow[] = [];

  groupOrdersByRelativeDate(allOrders).forEach((section, sectionIndex) => {
    if (section.data.length === 0) return;

    rows.push({
      type: 'header',
      id: `header-${section.title}-${sectionIndex}`,
      title: section.title,
    });
    section.data.forEach((order) => {
      rows.push({ type: 'item', id: order.id, order });
    });
  });

  return rows;
}

export function getStickyHeaderIndices(rows: OrdersListRow[]) {
  return rows
    .map((item, index) => (item.type === 'header' ? index : null))
    .filter((index): index is number => index !== null);
}

export function OrdersSectionHeader({
  title,
  colors,
}: {
  title: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[styles.sectionHeader, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 2,
    paddingTop: SPACING.xs,
    zIndex: 10,
  },
  sectionHeaderText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

export function dedupeOrdersById(orders: Order[]) {
  const seenIds = new Set<string>();

  return orders.filter((order) => {
    if (seenIds.has(order.id)) return false;
    seenIds.add(order.id);
    return true;
  });
}
