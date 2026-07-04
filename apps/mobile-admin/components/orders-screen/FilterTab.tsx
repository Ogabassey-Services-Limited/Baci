import { Pressable, StyleSheet, Text } from 'react-native';
import { RADIUS, TYPOGRAPHY } from '@/constants/theme';
import type {
  OrdersCountSnapshot,
  OrdersFilterKey,
  ThemeColors,
} from './types';

interface FilterTabProps {
  countKey: keyof OrdersCountSnapshot;
  filterKey: OrdersFilterKey;
  label: string;
  selectedFilter: OrdersFilterKey;
  counts: OrdersCountSnapshot | null | undefined;
  colors: ThemeColors;
  onSelect: (filter: OrdersFilterKey) => void;
}

export function FilterTab({
  countKey,
  filterKey,
  label,
  selectedFilter,
  counts,
  colors,
  onSelect,
}: FilterTabProps) {
  const isActive = selectedFilter === filterKey;
  const count = counts ? (counts[countKey] ?? 0) : 0;

  return (
    <Pressable
      style={[
        styles.filterTab,
        { backgroundColor: isActive ? colors.gold : colors.card },
      ]}
      onPress={() => onSelect(filterKey)}
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
