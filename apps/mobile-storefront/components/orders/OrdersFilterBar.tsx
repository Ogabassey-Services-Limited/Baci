import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BRAND } from '@/constants/Colors';
import type {
  OrderListFilterKey,
  OrderListFilterOption,
} from '@/lib/order-list-filters';

interface OrdersFilterBarColors {
  card: string;
  border: string;
  muted: string;
  text: string;
  textSecondary: string;
}

interface OrdersFilterBarProps {
  colors: OrdersFilterBarColors;
  orderFilters: OrderListFilterOption[];
  selectedFilter: OrderListFilterKey;
  onSelectFilter: (filter: OrderListFilterKey) => void;
  /** Safe-area bottom inset so the bar clears the home indicator. */
  bottomInset: number;
}

// Order status filters pinned to the bottom of the screen (thumb-reachable),
// instead of sitting at the top of the list.
export function OrdersFilterBar({
  colors,
  orderFilters,
  selectedFilter,
  onSelectFilter,
  bottomInset,
}: OrdersFilterBarProps) {
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(bottomInset, 12),
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {orderFilters.map((filter) => {
          const isActive = selectedFilter === filter.key;

          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => onSelectFilter(filter.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? BRAND.primary : colors.muted,
                  borderColor: isActive ? BRAND.primary : colors.border,
                },
              ]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter orders by ${filter.label}`}
            >
              <Text
                style={[
                  styles.filterLabel,
                  { color: isActive ? '#FFF' : colors.textSecondary },
                ]}
              >
                {filter.label}
              </Text>
              <Text
                style={[
                  styles.filterCount,
                  { color: isActive ? '#FFF' : colors.text },
                ]}
              >
                {filter.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  filterRow: {
    gap: 10,
    paddingRight: 4,
  },
  filterChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterCount: {
    fontSize: 15,
    fontWeight: '800',
  },
});
