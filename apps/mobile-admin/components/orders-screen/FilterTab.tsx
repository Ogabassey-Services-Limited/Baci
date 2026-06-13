import type { ShippingStatus } from '@baci/shared';
import { Pressable, StyleSheet, Text } from 'react-native';
import { RADIUS, TYPOGRAPHY } from '@/constants/theme';
import type { OrdersCountSnapshot, ThemeColors } from './types';

interface FilterTabProps {
  status: ShippingStatus | 'all';
  label: string;
  statusFilter: ShippingStatus | undefined;
  counts: OrdersCountSnapshot | null | undefined;
  colors: ThemeColors;
  onSelect: (status: ShippingStatus | undefined) => void;
}

export function FilterTab({
  status,
  label,
  statusFilter,
  counts,
  colors,
  onSelect,
}: FilterTabProps) {
  const isActive =
    (status === 'all' && !statusFilter) || statusFilter === status;
  const count = counts
    ? status === 'all'
      ? (counts.all ?? 0)
      : (counts[status] ?? 0)
    : 0;

  return (
    <Pressable
      style={[
        styles.filterTab,
        { backgroundColor: isActive ? colors.gold : colors.card },
      ]}
      onPress={() => onSelect(status === 'all' ? undefined : status)}
      accessibilityLabel={`${label} orders: ${count}${isActive ? ', currently selected' : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityHint={`Filter to show ${label.toLowerCase()} orders`}
    >
      <Text
        style={[
          styles.filterText,
          { color: isActive ? colors.textOnGold : colors.textSecondary },
        ]}
      >
        {label} ({count})
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
