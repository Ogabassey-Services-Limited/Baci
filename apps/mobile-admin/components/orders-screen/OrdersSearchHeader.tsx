import Ionicons from '@react-native-vector-icons/ionicons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { FilterTab } from './FilterTab';
import type {
  OrdersCountSnapshot,
  OrdersFilterKey,
  ThemeColors,
} from './types';

interface OrdersSearchHeaderProps {
  colors: ThemeColors;
  searchQuery: string;
  selectedFilter: OrdersFilterKey;
  counts: OrdersCountSnapshot | null | undefined;
  onSearchChange: (value: string) => void;
  onFilterSelect: (filter: OrdersFilterKey) => void;
}

const ORDER_FILTERS: Array<{
  countKey: keyof OrdersCountSnapshot;
  key: OrdersFilterKey;
  label: string;
}> = [
  { countKey: 'all', key: 'all', label: 'All' },
  { countKey: 'paid', key: 'paid', label: 'Paid' },
  { countKey: 'pending', key: 'pending', label: 'Pending' },
  { countKey: 'processing', key: 'processing', label: 'Processing' },
  { countKey: 'shipped', key: 'shipped', label: 'Shipped' },
  { countKey: 'delivered', key: 'delivered', label: 'Delivered' },
  { countKey: 'cancelled', key: 'cancelled', label: 'Cancelled' },
  { countKey: 'returned', key: 'returned', label: 'Returned' },
];

const FILTER_ROW_GAP = SPACING.lg;

export function OrdersSearchHeader({
  colors,
  searchQuery,
  selectedFilter,
  counts,
  onSearchChange,
  onFilterSelect,
}: OrdersSearchHeaderProps) {
  return (
    <View testID="orders-search-header" style={styles.searchContainer}>
      <SearchBar
        colors={colors}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterContainer}
        testID="orders-filter-row"
      >
        {ORDER_FILTERS.map((filter) => (
          <FilterTab
            countKey={filter.countKey}
            key={filter.key}
            filterKey={filter.key}
            label={filter.label}
            selectedFilter={selectedFilter}
            counts={counts}
            colors={colors}
            onSelect={onFilterSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SearchBar({
  colors,
  searchQuery,
  onSearchChange,
}: Pick<OrdersSearchHeaderProps, 'colors' | 'searchQuery' | 'onSearchChange'>) {
  return (
    <View
      testID="orders-search-bar"
      style={[styles.searchBar, { backgroundColor: colors.card }]}
    >
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search orders or customers..."
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchQuery.length > 0 ? (
        <Pressable
          onPress={() => onSearchChange('')}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: 0,
    flexShrink: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: SPACING.xs,
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: { marginTop: FILTER_ROW_GAP },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingRight: SPACING.xl,
  },
});
