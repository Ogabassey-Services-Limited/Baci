import type { ShippingStatus } from '@baci/shared';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { FilterTab } from './FilterTab';
import type { OrdersCountSnapshot, ThemeColors } from './types';

interface OrdersSearchHeaderProps {
  colors: ThemeColors;
  searchQuery: string;
  searchHeaderStyle: object;
  statusFilter: ShippingStatus | undefined;
  counts: OrdersCountSnapshot | null | undefined;
  onSearchChange: (value: string) => void;
  onStatusSelect: (status: ShippingStatus | undefined) => void;
}

const ORDER_FILTERS: Array<{ status: ShippingStatus | 'all'; label: string }> =
  [
    { status: 'all', label: 'All' },
    { status: 'pending', label: 'Pending' },
    { status: 'processing', label: 'Processing' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'delivered', label: 'Delivered' },
    { status: 'cancelled', label: 'Cancelled' },
    { status: 'returned', label: 'Returned' },
  ];

export function OrdersSearchHeader({
  colors,
  searchQuery,
  searchHeaderStyle,
  statusFilter,
  counts,
  onSearchChange,
  onStatusSelect,
}: OrdersSearchHeaderProps) {
  return (
    <Animated.View style={[styles.searchContainer, searchHeaderStyle]}>
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
      >
        {ORDER_FILTERS.map((filter) => (
          <FilterTab
            key={filter.status}
            status={filter.status}
            label={filter.label}
            statusFilter={statusFilter}
            counts={counts}
            colors={colors}
            onSelect={onStatusSelect}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function SearchBar({
  colors,
  searchQuery,
  onSearchChange,
}: Pick<OrdersSearchHeaderProps, 'colors' | 'searchQuery' | 'onSearchChange'>) {
  return (
    <Animated.View style={[styles.searchBar, { backgroundColor: colors.card }]}>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
  filterContainer: { marginTop: SPACING.sm },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingRight: SPACING.xl,
  },
});
